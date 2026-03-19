var DB_NAME='lamatrak_offline';var DB_VERSION=1;
var LocalDB={
db:null,
init:function(){
return new Promise(function(resolve,reject){
var request=indexedDB.open(DB_NAME,DB_VERSION);
request.onupgradeneeded=function(e){
var db=e.target.result;
if(!db.objectStoreNames.contains('patrols')){var p=db.createObjectStore('patrols',{keyPath:'id'});p.createIndex('ranger_id','ranger_id',{unique:false});p.createIndex('status','status',{unique:false});p.createIndex('synced','synced',{unique:false})}
if(!db.objectStoreNames.contains('observations')){var o=db.createObjectStore('observations',{keyPath:'id'});o.createIndex('patrol_id','patrol_id',{unique:false});o.createIndex('type','type',{unique:false});o.createIndex('synced','synced',{unique:false})}
if(!db.objectStoreNames.contains('tracks')){var t=db.createObjectStore('tracks',{keyPath:'id'});t.createIndex('patrol_id','patrol_id',{unique:false});t.createIndex('synced','synced',{unique:false})}
if(!db.objectStoreNames.contains('checkins')){var c=db.createObjectStore('checkins',{keyPath:'id'});c.createIndex('ranger_id','ranger_id',{unique:false});c.createIndex('synced','synced',{unique:false})}
if(!db.objectStoreNames.contains('users')){db.createObjectStore('users',{keyPath:'id'})}
};
request.onsuccess=function(e){LocalDB.db=e.target.result;resolve(LocalDB.db)};
request.onerror=function(e){reject(e.target.error)}
})},
uuid:function(){return'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){var r=Math.random()*16|0;return(c==='x'?r:(r&0x3|0x8)).toString(16)})},
put:function(s,r){return new Promise(function(resolve,reject){var txn=LocalDB.db.transaction(s,'readwrite');var req=txn.objectStore(s).put(r);req.onsuccess=function(){resolve(req.result)};req.onerror=function(){reject(req.error)}})},
get:function(s,id){return new Promise(function(resolve,reject){var txn=LocalDB.db.transaction(s,'readonly');var req=txn.objectStore(s).get(id);req.onsuccess=function(){resolve(req.result)};req.onerror=function(){reject(req.error)}})},
getAll:function(s){return new Promise(function(resolve,reject){var txn=LocalDB.db.transaction(s,'readonly');var req=txn.objectStore(s).getAll();req.onsuccess=function(){resolve(req.result)};req.onerror=function(){reject(req.error)}})},
getAllByIndex:function(s,idx,val){return new Promise(function(resolve,reject){var txn=LocalDB.db.transaction(s,'readonly');var req=txn.objectStore(s).index(idx).getAll(val);req.onsuccess=function(){resolve(req.result)};req.onerror=function(){reject(req.error)}})},
getUnsyncedCount:async function(){var total=0;var stores=['patrols','observations','tracks','checkins'];for(var i=0;i<stores.length;i++){var items=await LocalDB.getAllByIndex(stores[i],'synced',0);total+=items.length}return total},
getUnsyncedData:async function(){return{patrols:await LocalDB.getAllByIndex('patrols','synced',0),observations:await LocalDB.getAllByIndex('observations','synced',0),tracks:await LocalDB.getAllByIndex('tracks','synced',0),checkins:await LocalDB.getAllByIndex('checkins','synced',0)}},
markSynced:async function(storeName,ids){var txn=LocalDB.db.transaction(storeName,'readwrite');var store=txn.objectStore(storeName);for(var i=0;i<ids.length;i++){var record=await new Promise(function(resolve){var req=store.get(ids[i]);req.onsuccess=function(){resolve(req.result)}});if(record){record.synced=1;record.synced_at=new Date().toISOString();store.put(record)}}return new Promise(function(resolve){txn.oncomplete=resolve})},
createPatrol:async function(rangerId,patrolType,lat,lng){var patrol={id:LocalDB.uuid(),ranger_id:rangerId,patrol_type:patrolType,start_time:new Date().toISOString(),end_time:null,start_lat:lat,start_lng:lng,end_lat:null,end_lng:null,notes:'',status:'active',synced:0,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};await LocalDB.put('patrols',patrol);return patrol},
endPatrol:async function(patrolId,lat,lng){var patrol=await LocalDB.get('patrols',patrolId);if(patrol){patrol.end_time=new Date().toISOString();patrol.end_lat=lat;patrol.end_lng=lng;patrol.status='completed';patrol.synced=0;patrol.updated_at=new Date().toISOString();await LocalDB.put('patrols',patrol)}return patrol},
createObservation:async function(patrolId,type,lat,lng,data,photoPaths,isRestricted){var obs={id:LocalDB.uuid(),patrol_id:patrolId,type:type,lat:lat,lng:lng,data:data,photo_paths:photoPaths||[],is_restricted:isRestricted?1:0,recorded_at:new Date().toISOString(),synced:0,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};await LocalDB.put('observations',obs);return obs},
addTrackPoint:async function(patrolId,lat,lng,altitude,accuracy){var point={id:LocalDB.uuid(),patrol_id:patrolId,lat:lat,lng:lng,altitude:altitude,accuracy:accuracy,recorded_at:new Date().toISOString(),synced:0};await LocalDB.put('tracks',point);return point},
createCheckin:async function(rangerId,patrolId,lat,lng,status){var checkin={id:LocalDB.uuid(),ranger_id:rangerId,patrol_id:patrolId,lat:lat,lng:lng,status:status||'ok',recorded_at:new Date().toISOString(),synced:0};await LocalDB.put('checkins',checkin);return checkin}
};