self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
  let data={title:'SoundCapsule',body:'새로운 소식이 도착했어요.'};
  try{data={...data,...event.data.json()}}catch{if(event.data)data.body=event.data.text()}
  event.waitUntil(self.registration.showNotification(data.title,{body:data.body,icon:'/favicon.svg',badge:'/favicon.svg',tag:data.tag||'soundcapsule-push',data:{url:data.url||'/'}}));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{const url=event.notification.data?.url||'/';const target=new URL(url,self.location.origin).href;const existing=clients.find(client=>'focus'in client);if(existing){if('navigate'in existing)await existing.navigate(target);return existing.focus()}return self.clients.openWindow(target)}));
});
