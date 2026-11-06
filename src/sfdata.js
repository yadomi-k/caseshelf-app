// CaseShelfのデータをSalesforceに読み書きする
//
// 保存先（Salesforceに作るカスタムオブジェクト。作り方は docs/salesforce-setup.md）
//   CaseShelf_Post__c     投稿（案件名・説明・タグ・物件No・商談URL・写真の並び）
//   CaseShelf_User__c     CaseShelfの利用者（表示名・メール・権限・状態・プロフィール画像）
//   CaseShelf_Save__c     保存（ブックマーク）。所有者＝保存した人
//   CaseShelf_Request__c  未登録の人からの利用登録の依頼
//   CaseShelf_Reaction__c 投稿へのリアクション（絵文字）。作成者＝リアクションした人
//   写真・プロフィール画像は Salesforce のファイル（ContentVersion）として、投稿・利用者のレコードにひも付けて保存する。
//
// 投稿者は、投稿レコードの「作成者」（Salesforceのユーザー）のメールアドレスで CaseShelf の利用者と対応させる。
window.AppSF = (function () {
  "use strict";

  var OBJ = {
    post: "CaseShelf_Post__c",
    user: "CaseShelf_User__c",
    save: "CaseShelf_Save__c",
    request: "CaseShelf_Request__c",
    reaction: "CaseShelf_Reaction__c",
  };

  function api(method, path, body, opts) {
    return AppSSO.api(method, path, body, opts);
  }
  var q = function (v) {
    return AppSSO.soqlString(v);
  };

  // SOQLを実行し、2000件を超える場合も続きを取得してすべて返す
  function query(soql) {
    var out = [];
    function next(path) {
      return api("GET", path).then(function (body) {
        out = out.concat((body && body.records) || []);
        if (body && !body.done && body.nextRecordsUrl) return next(body.nextRecordsUrl);
        return out;
      });
    }
    return next("/query?q=" + encodeURIComponent(soql));
  }

  function create(obj, fields) {
    return api("POST", "/sobjects/" + obj, fields).then(function (r) {
      return r.id;
    });
  }
  function update(obj, id, fields) {
    return api("PATCH", "/sobjects/" + obj + "/" + id, fields);
  }
  function remove(obj, id) {
    return api("DELETE", "/sobjects/" + obj + "/" + id);
  }

  // ------------------------------------------------------------------
  // 変換
  // ------------------------------------------------------------------
  function toUser(r) {
    return {
      id: r.Id,
      displayName: r.Name || r.Email__c || "",
      email: r.Email__c || "",
      role: r.Role__c === "admin" ? "admin" : "member",
      status: r.Status__c === "suspended" ? "suspended" : "active",
      avatarVersionId: r.AvatarVersionId__c || null,
    };
  }

  function parsePhotos(text) {
    try {
      var arr = JSON.parse(text || "[]");
      return Array.isArray(arr)
        ? arr
            .filter(function (p) {
              return p && p.id;
            })
            .map(function (p, i) {
              return { id: p.id, size: p.size || 0, order: i };
            })
        : [];
    } catch (e) {
      return [];
    }
  }

  function toPost(r) {
    var photos = parsePhotos(r.Photos__c);
    return {
      id: r.Id,
      title: r.Title__c || "",
      description: r.Description__c || "",
      tags: String(r.Tags__c || "")
        .split(/\r?\n/)
        .map(function (t) {
          return t.trim();
        })
        .filter(Boolean),
      photos: photos,
      coverPhotoId: r.CoverPhotoId__c || (photos[0] && photos[0].id) || null,
      propertyNo: r.PropertyNo__c || "",
      salesforceUrl: r.SalesforceUrl__c || "",
      createdAt: r.CreatedDate,
      updatedAt: r.LastModifiedDate,
      authorEmail: (r.CreatedBy && r.CreatedBy.Email) || "",
      createdById: r.CreatedById || "",
      authorName: (r.CreatedBy && r.CreatedBy.Name) || "",
    };
  }

  function postFields(payload) {
    return {
      Title__c: payload.title,
      Description__c: payload.description || "",
      Tags__c: (payload.tags || []).join("\n"),
      PropertyNo__c: payload.propertyNo || "",
      SalesforceUrl__c: payload.salesforceUrl || "",
      Photos__c: JSON.stringify(
        (payload.photos || []).map(function (p) {
          return { id: p.id, size: p.size || 0 };
        })
      ),
      CoverPhotoId__c: payload.coverPhotoId || "",
    };
  }

  // ------------------------------------------------------------------
  // 読み込み
  // ------------------------------------------------------------------
  var USER_FIELDS = "Id, Name, Email__c, Role__c, Status__c, AvatarVersionId__c";

  function findUserByEmail(email) {
    return query(
      "SELECT " + USER_FIELDS + " FROM " + OBJ.user + " WHERE Email__c = " + q(email) + " LIMIT 1"
    ).then(function (rs) {
      return rs.length ? toUser(rs[0]) : null;
    });
  }

  function loadUsers() {
    return query("SELECT " + USER_FIELDS + " FROM " + OBJ.user + " ORDER BY CreatedDate").then(function (rs) {
      return rs.map(toUser);
    });
  }

  function loadPosts() {
    return query(
      "SELECT Id, Title__c, Description__c, Tags__c, PropertyNo__c, SalesforceUrl__c, Photos__c, CoverPhotoId__c, " +
        "CreatedDate, LastModifiedDate, CreatedById, CreatedBy.Email, CreatedBy.Name FROM " + OBJ.post + " ORDER BY CreatedDate DESC"
    ).then(function (rs) {
      return rs.map(toPost);
    });
  }

  // 自分の保存（ブックマーク）。[{ id, postId }]
  function loadMySaves(sfUserId) {
    var where = sfUserId ? " WHERE OwnerId = " + q(sfUserId) : "";
    return query("SELECT Id, Post__c FROM " + OBJ.save + where).then(function (rs) {
      return rs.map(function (r) {
        return { id: r.Id, postId: r.Post__c || null };
      });
    });
  }

  // 全員のリアクション。[{ id, postId, emoji, createdById, email, name }]
  function toReaction(r) {
    return {
      id: r.Id,
      postId: r.Post__c || null,
      emoji: r.Emoji__c || "",
      createdById: r.CreatedById || "",
      email: (r.CreatedBy && r.CreatedBy.Email) || "",
      name: (r.CreatedBy && r.CreatedBy.Name) || "",
    };
  }
  var REACTION_FIELDS = "Id, Post__c, Emoji__c, CreatedById, CreatedBy.Email, CreatedBy.Name";

  function loadReactions() {
    return query("SELECT " + REACTION_FIELDS + " FROM " + OBJ.reaction + " ORDER BY CreatedDate").then(function (rs) {
      return rs.map(toReaction);
    });
  }

  // 1件の投稿のリアクションだけを読み込み直す（詳細画面を開いたとき）
  function loadPostReactions(postId) {
    return query(
      "SELECT " + REACTION_FIELDS + " FROM " + OBJ.reaction + " WHERE Post__c = " + q(postId) + " ORDER BY CreatedDate"
    ).then(function (rs) {
      return rs.map(toReaction);
    });
  }

  function toRequest(r) {
    return {
      id: r.Id,
      name: r.Name || "",
      email: r.Email__c || "",
      status: r.Status__c || "pending",
      requestedAt: r.CreatedDate,
    };
  }

  function loadPendingRequests() {
    return query(
      "SELECT Id, Name, Email__c, Status__c, CreatedDate FROM " + OBJ.request +
        " WHERE Status__c = 'pending' ORDER BY CreatedDate"
    ).then(function (rs) {
      return rs.map(toRequest);
    });
  }

  // ------------------------------------------------------------------
  // ファイル（写真）
  // ------------------------------------------------------------------
  function dataUrlToBase64(dataUrl) {
    var i = String(dataUrl).indexOf(",");
    return i === -1 ? "" : String(dataUrl).slice(i + 1);
  }

  // 画像（data URL）をファイルとして保存し、指定したレコードにひも付ける。ContentVersion の Id を返す。
  function uploadImage(dataUrl, recordId, title) {
    return create("ContentVersion", {
      Title: title || "CaseShelf写真",
      PathOnClient: (title || "photo") + ".jpg",
      VersionData: dataUrlToBase64(dataUrl),
      FirstPublishLocationId: recordId,
    });
  }

  // ファイルを削除する（失敗しても処理は続ける）
  function deleteFiles(versionIds) {
    var ids = (versionIds || []).filter(Boolean);
    if (!ids.length) return Promise.resolve();
    return query(
      "SELECT ContentDocumentId FROM ContentVersion WHERE Id IN (" + ids.map(q).join(",") + ")"
    )
      .then(function (rs) {
        return Promise.all(
          rs.map(function (r) {
            return remove("ContentDocument", r.ContentDocumentId).catch(function () {});
          })
        );
      })
      .catch(function () {});
  }

  // 画像を表示用のURL（blob:）にする。同じ画像は一度だけ取得する。
  var imageCache = {};
  function imageUrl(versionId) {
    if (!imageCache[versionId]) {
      imageCache[versionId] = api("GET", "/sobjects/ContentVersion/" + versionId + "/VersionData", null, { raw: true })
        .then(function (res) {
          return res.blob();
        })
        .then(function (blob) {
          return URL.createObjectURL(blob);
        })
        .catch(function (e) {
          delete imageCache[versionId]; // 次回もう一度試す
          throw e;
        });
    }
    return imageCache[versionId];
  }

  // 写真リストのうち、まだ保存していないもの（dataUrl を持つもの）をアップロードし、
  // すべて ContentVersion の Id に置き換えたリストと、仮ID→Id の対応を返す。
  function uploadNewPhotos(photos, recordId) {
    var idMap = {};
    // 順番に1枚ずつ送る（大きなデータの同時送信を避ける）
    return photos
      .reduce(function (chain, p, i) {
        return chain.then(function (acc) {
          if (!p.dataUrl) return acc.concat([{ id: p.id, size: p.size || 0 }]);
          return uploadImage(p.dataUrl, recordId, "CaseShelf写真" + (i + 1)).then(function (vid) {
            idMap[p.id] = vid;
            return acc.concat([{ id: vid, size: p.size || 0 }]);
          });
        });
      }, Promise.resolve([]))
      .then(function (list) {
        return { photos: list, idMap: idMap };
      });
  }

  // ------------------------------------------------------------------
  // 投稿
  // ------------------------------------------------------------------
  // payload.photos: [{ id, size, dataUrl? }]（dataUrl があるものは新しい写真）
  function createPost(payload) {
    var postId;
    return create(OBJ.post, postFields(Object.assign({}, payload, { photos: [], coverPhotoId: "" })))
      .then(function (id) {
        postId = id;
        return uploadNewPhotos(payload.photos, postId);
      })
      .then(function (r) {
        var cover = r.idMap[payload.coverPhotoId] || payload.coverPhotoId;
        return update(OBJ.post, postId, postFields(Object.assign({}, payload, { photos: r.photos, coverPhotoId: cover })));
      })
      .then(function () {
        return postId;
      })
      .catch(function (e) {
        // 写真の保存に失敗した場合は、途中まで作った投稿を消す
        if (postId) remove(OBJ.post, postId).catch(function () {});
        throw e;
      });
  }

  // removedPhotoIds: 編集で外した写真（ファイルを削除する）
  function updatePost(postId, payload, removedPhotoIds) {
    return uploadNewPhotos(payload.photos, postId)
      .then(function (r) {
        var cover = r.idMap[payload.coverPhotoId] || payload.coverPhotoId;
        return update(OBJ.post, postId, postFields(Object.assign({}, payload, { photos: r.photos, coverPhotoId: cover })));
      })
      .then(function () {
        return deleteFiles(removedPhotoIds);
      });
  }

  function deletePost(postId, photoIds) {
    return deleteFiles(photoIds).then(function () {
      return remove(OBJ.post, postId);
    });
  }

  function updatePostTags(postId, tags) {
    return update(OBJ.post, postId, { Tags__c: tags.join("\n") });
  }

  // ------------------------------------------------------------------
  // 保存（ブックマーク）
  // ------------------------------------------------------------------
  function addSave(postId) {
    return create(OBJ.save, { Post__c: postId });
  }
  function removeSave(saveId) {
    return remove(OBJ.save, saveId);
  }

  // ------------------------------------------------------------------
  // リアクション
  // ------------------------------------------------------------------
  function addReaction(postId, emoji) {
    return create(OBJ.reaction, { Post__c: postId, Emoji__c: emoji });
  }
  function removeReaction(reactionId) {
    return remove(OBJ.reaction, reactionId);
  }

  // ------------------------------------------------------------------
  // 利用者
  // ------------------------------------------------------------------
  function createUser(data) {
    return create(OBJ.user, {
      Name: String(data.displayName || data.email).slice(0, 80),
      Email__c: data.email,
      Role__c: data.role === "admin" ? "admin" : "member",
      Status__c: "active",
    }).then(function (id) {
      return {
        id: id,
        displayName: String(data.displayName || data.email).slice(0, 80),
        email: data.email,
        role: data.role === "admin" ? "admin" : "member",
        status: "active",
        avatarVersionId: null,
      };
    });
  }

  // patch: { displayName?, status?, avatarVersionId? }
  function updateUser(userId, patch) {
    var f = {};
    if (patch.displayName !== undefined) f.Name = String(patch.displayName).slice(0, 80);
    if (patch.status !== undefined) f.Status__c = patch.status;
    if (patch.avatarVersionId !== undefined) f.AvatarVersionId__c = patch.avatarVersionId || "";
    return update(OBJ.user, userId, f);
  }

  // ------------------------------------------------------------------
  // 利用登録の依頼
  // ------------------------------------------------------------------
  // 同じメールアドレスの未対応の依頼があれば作らない。{ duplicate: true } か { id } を返す
  function createRequest(profile) {
    return query(
      "SELECT Id FROM " + OBJ.request + " WHERE Status__c = 'pending' AND Email__c = " + q(profile.email) + " LIMIT 1"
    ).then(function (rs) {
      if (rs.length) return { duplicate: true };
      return create(OBJ.request, {
        Name: String(profile.name || profile.email).slice(0, 80),
        Email__c: profile.email,
        Status__c: "pending",
      }).then(function (id) {
        return { id: id };
      });
    });
  }

  function setRequestStatus(reqId, status) {
    return update(OBJ.request, reqId, { Status__c: status, HandledAt__c: new Date().toISOString() });
  }

  return {
    OBJ: OBJ,
    findUserByEmail: findUserByEmail,
    loadUsers: loadUsers,
    loadPosts: loadPosts,
    loadMySaves: loadMySaves,
    loadPendingRequests: loadPendingRequests,
    loadReactions: loadReactions,
    loadPostReactions: loadPostReactions,
    addReaction: addReaction,
    removeReaction: removeReaction,
    imageUrl: imageUrl,
    uploadImage: uploadImage,
    deleteFiles: deleteFiles,
    createPost: createPost,
    updatePost: updatePost,
    deletePost: deletePost,
    updatePostTags: updatePostTags,
    addSave: addSave,
    removeSave: removeSave,
    createUser: createUser,
    updateUser: updateUser,
    createRequest: createRequest,
    setRequestStatus: setRequestStatus,
  };
})();
