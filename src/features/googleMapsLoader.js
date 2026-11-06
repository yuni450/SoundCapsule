let mapsLoader;

export function loadGoogleMaps() {
  const apiKey=import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if(!apiKey)return Promise.reject(new Error('Google Maps API 키가 필요해요.'));
  if(typeof window.google?.maps?.importLibrary==='function')return Promise.resolve(window.google.maps);
  if(mapsLoader)return mapsLoader;
  mapsLoader=new Promise((resolve,reject)=>{
    const existing=document.querySelector('script[data-soundcapsule-google-maps]');
    const script=existing||document.createElement('script');let attempts=0;
    const ready=()=>{if(typeof window.google?.maps?.importLibrary==='function'){resolve(window.google.maps);return}if(attempts++>=120){reject(new Error('Google Maps API를 초기화하지 못했어요.'));return}window.setTimeout(ready,50)};
    script.addEventListener('error',()=>reject(new Error('Google Maps API를 불러오지 못했어요.')),{once:true});
    if(!existing){script.src=`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=marker&v=weekly&loading=async&language=ko&region=KR`;script.async=true;script.dataset.soundcapsuleGoogleMaps='true';document.head.appendChild(script)}
    ready();
  });
  return mapsLoader;
}

export function addressParts(result){
  const parts=result?.address_components||[];const pick=(...types)=>parts.find(part=>types.some(type=>part.types.includes(type)))?.long_name||'';
  return{address:result?.formatted_address||'',country:pick('country'),city:pick('locality','administrative_area_level_1','administrative_area_level_2')};
}

export async function reverseGeocode(latitude,longitude){
  if(!Number.isFinite(latitude)||Math.abs(latitude)>90||!Number.isFinite(longitude)||Math.abs(longitude)>180)throw new Error('위도와 경도를 확인해 주세요.');
  const maps=await loadGoogleMaps();const {Geocoder}=await maps.importLibrary('geocoding');
  return new Promise((resolve,reject)=>new Geocoder().geocode({location:{lat:latitude,lng:longitude}},(results,status)=>status==='OK'&&results?.[0]?resolve(addressParts(results[0])):reject(new Error('이 좌표의 장소명을 찾지 못했어요.'))));
}
