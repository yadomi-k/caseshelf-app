// CaseShelfのデータをSalesforceに読み書きする
//
// 保存先（Salesforceに作るカスタムオブジェクト。作り方は docs/salesforce-setup.md）
//   CaseShelf_Post__c     投稿（案件名・説明・タグ・物件No・商談URL・写真の並び・デザイン担当者）
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

  // デザイン担当者 [{ dept, name, email }]（1人1件）。
  // email は Salesforce のユーザーのメールアドレスで、CaseShelf の利用者と結び付けるのに使う。
  // 以前の形式（1件に「山田、鈴木」のように複数人）も1人ずつに分ける。
  function parseDesignStaff(text) {
    try {
      var arr = JSON.parse(text || "[]");
      if (!Array.isArray(arr)) return [];
      var out = [];
      arr.forEach(function (d) {
        if (!d || !d.name) return;
        var names = splitNames(d.name);
        names.forEach(function (name) {
          out.push({ dept: String(d.dept || ""), name: name, email: names.length === 1 ? String(d.email || "") : "" });
        });
      });
      return out;
    } catch (e) {
      return [];
    }
  }

  function splitNames(text) {
    return String(text || "")
      .split(/[、,，\n]/)
      .map(function (n) {
        return n.trim();
      })
      .filter(Boolean);
  }

  // 後から追加した投稿の項目。Salesforceに項目を追加する前でも他の機能が動くよう、
  // 読み込みで「項目が無い」エラーになったものは使わない（true = 使える）
  var optionalPostFields = {
    DesignStaff__c: true, // デザイン担当者
    AuthorEmail__c: true, // 投稿者（代理で投稿したときに表示する人のメールアドレス）
  };
  var hasDesignStaffField = true; // optionalPostFields.DesignStaff__c と同じ（読み込み後に更新）

  function toPost(r) {
    var photos = parsePhotos(r.Photos__c);
    var creatorEmail = (r.CreatedBy && r.CreatedBy.Email) || "";
    var authorEmail = r.AuthorEmail__c || creatorEmail;
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
      // 投稿者（表示する人）。代理で投稿したときは選んだ人、そうでなければ投稿した人
      authorEmail: authorEmail,
      // 実際に投稿した人（Salesforceのレコードの作成者。編集・削除できるのはこの人と管理者）
      creatorEmail: creatorEmail,
      createdById: r.CreatedById || "",
      // Salesforce上の所有者（編集・削除できるのは所有者と管理者）。代理投稿では投稿者に選んだ人になる
      ownerId: r.OwnerId || "",
      ownerEmail: (r.Owner && r.Owner.Email) || "",
      authorName: r.AuthorEmail__c ? "" : (r.CreatedBy && r.CreatedBy.Name) || "",
      designStaff: parseDesignStaff(r.DesignStaff__c),
    };
  }

  function postFields(payload) {
    var f = {
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
    if (optionalPostFields.AuthorEmail__c && payload.authorEmail !== undefined) {
      f.AuthorEmail__c = payload.authorEmail || "";
    }
    if (hasDesignStaffField) {
      f.DesignStaff__c = JSON.stringify(
        (payload.designStaff || [])
          .filter(function (d) {
            return d && d.name;
          })
          .map(function (d) {
            return d.email ? { dept: d.dept, name: d.name, email: d.email } : { dept: d.dept, name: d.name };
          })
      );
    }
    return f;
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
    function run() {
      var extra = Object.keys(optionalPostFields).filter(function (k) {
        return optionalPostFields[k];
      });
      return query(
        "SELECT Id, Title__c, Description__c, Tags__c, PropertyNo__c, SalesforceUrl__c, Photos__c, CoverPhotoId__c, " +
          extra.map(function (k) { return k + ", "; }).join("") +
          "CreatedDate, LastModifiedDate, CreatedById, CreatedBy.Email, CreatedBy.Name, OwnerId, Owner.Email FROM " + OBJ.post + " ORDER BY CreatedDate DESC"
      );
    }
    function attempt() {
      return run().catch(function (e) {
        // 後から追加した項目がまだ無い（または参照できない）場合は、その項目なしで読み込み直す
        if (e.code === "INVALID_FIELD") {
          var missing = Object.keys(optionalPostFields).filter(function (k) {
            return optionalPostFields[k] && e.message.indexOf(k) !== -1;
          });
          if (missing.length) {
            missing.forEach(function (k) {
              optionalPostFields[k] = false;
            });
            hasDesignStaffField = optionalPostFields.DesignStaff__c;
            return attempt();
          }
        }
        throw e;
      });
    }
    return attempt().then(function (rs) {
      return rs.map(toPost);
    });
  }

  // ------------------------------------------------------------------
  // デザイン担当者（商談 → 商談商品（デザイン部門）→ プロジェクト管理 → 所有者）
  // ------------------------------------------------------------------
  function designConfig() {
    var c = (window.AppConfig && window.AppConfig.designStaff) || {};
    return {
      departments: c.departments || [],
      projectObject: c.projectObject || "",
      lineItemField: c.lineItemField || "",
    };
  }

  // 商談のデザイン担当者を探す。[{ dept, name, email }]（1人1件・部門の並び順）
  var ownerEmailOk = true;
  function findDesignStaff(opportunityId) {
    var c = designConfig();
    if (!c.departments.length || !/^[A-Za-z0-9_]+__c$/.test(c.projectObject) || !/^[A-Za-z0-9_]+__c$/.test(c.lineItemField)) {
      return Promise.reject(new Error("デザイン担当者の設定が正しくありません（src/config.js の designStaff）。"));
    }
    var rel = c.lineItemField.replace(/__c$/, "__r");
    function run() {
      return query(
        "SELECT Owner.Name, " + (ownerEmailOk ? "Owner.Email, " : "") + rel + ".Product2.Name FROM " + c.projectObject +
          " WHERE " + rel + ".OpportunityId = " + q(opportunityId) +
          " AND " + rel + ".Product2.Name IN (" + c.departments.map(q).join(",") + ")" +
          " ORDER BY CreatedDate"
      );
    }
    return run()
      .catch(function (e) {
        // 所有者のメールアドレスが取れない環境では、名前だけで探す
        if (ownerEmailOk && e.code === "INVALID_FIELD" && /Email/.test(e.message)) {
          ownerEmailOk = false;
          return run();
        }
        throw e;
      })
      .then(function (rs) {
        var byDept = {};
        rs.forEach(function (r) {
          var dept = r[rel] && r[rel].Product2 && r[rel].Product2.Name;
          var name = r.Owner && r.Owner.Name;
          if (!dept || !name) return;
          var list = byDept[dept] || (byDept[dept] = []);
          if (list.some(function (p) { return p.name === name; })) return;
          list.push({ dept: dept, name: name, email: (r.Owner && r.Owner.Email) || "" });
        });
        var out = [];
        c.departments.forEach(function (d) {
          if (byDept[d]) out = out.concat(byDept[d]);
        });
        return out;
      });
  }

  // Salesforceの有効なユーザーの「部」を、メールアドレス（小文字）ごとに返す。{ email: 部 }
  function loadUserDepartments() {
    var c = (window.AppConfig && window.AppConfig.userDepartment) || {};
    var field = c.field || "";
    if (!/^[A-Za-z0-9_]+__c$/.test(field)) return Promise.reject(new Error("部の項目名の設定が正しくありません。"));
    return query("SELECT Email, " + field + " FROM User WHERE IsActive = true AND Email != null").then(function (rs) {
      var map = {};
      rs.forEach(function (r) {
        if (r.Email && r[field]) map[String(r.Email).toLowerCase()] = String(r[field]);
      });
      return map;
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
      // Salesforce上の所有者（編集・削除できるのは所有者と管理者）。代理投稿では投稿者に選んだ人になる
      ownerId: r.OwnerId || "",
      ownerEmail: (r.Owner && r.Owner.Email) || "",
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

  // メールアドレスから Salesforce のユーザーID を探す（有効なユーザーのみ）。見つからなければ null
  var sfUserIdCache = {};
  function findSfUserIdByEmail(email) {
    var key = String(email || "").trim().toLowerCase();
    if (!key) return Promise.resolve(null);
    if (sfUserIdCache[key] !== undefined) return Promise.resolve(sfUserIdCache[key]);
    return query("SELECT Id FROM User WHERE Email = " + q(key) + " AND IsActive = true ORDER BY CreatedDate LIMIT 1").then(function (rs) {
      sfUserIdCache[key] = rs.length ? rs[0].Id : null;
      return sfUserIdCache[key];
    });
  }

  // 投稿の所有者を、メールアドレスの人に変更する（代理投稿）
  function changePostOwner(postId, email) {
    return findSfUserIdByEmail(email).then(function (uid) {
      if (!uid) {
        throw new Error("Salesforceに " + email + " の有効なユーザーが見つかりませんでした。");
      }
      return update(OBJ.post, postId, { OwnerId: uid }).then(function () {
        return uid;
      });
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
    designStaffAvailable: function () {
      return hasDesignStaffField;
    },
    authorFieldAvailable: function () {
      return optionalPostFields.AuthorEmail__c;
    },
    designDepartments: function () {
      return designConfig().departments;
    },
    findDesignStaff: findDesignStaff,
    splitNames: splitNames,
    loadMySaves: loadMySaves,
    loadUserDepartments: loadUserDepartments,
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
    changePostOwner: changePostOwner,
    addSave: addSave,
    removeSave: removeSave,
    createUser: createUser,
    updateUser: updateUser,
    createRequest: createRequest,
    setRequestStatus: setRequestStatus,
  };
})();
