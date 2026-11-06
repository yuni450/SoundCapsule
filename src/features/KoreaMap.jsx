import { useEffect, useMemo, useState } from 'react';

const provinceNames = {
  '11':'서울','21':'부산','22':'대구','23':'인천','24':'광주','25':'대전','26':'울산','29':'세종',
  '31':'경기','32':'강원','33':'충북','34':'충남','35':'전북','36':'전남','37':'경북','38':'경남','39':'제주',
};
const cityToCode = {'서울':'11','부산':'21','대구':'22','인천':'23','광주':'24','대전':'25','울산':'26','세종':'29','수원':'31','경기':'31','강원':'32','충북':'33','충남':'34','전북':'35','전남':'36','경북':'37','경남':'38','제주':'39'};
const bounds = { minLon:124.4,maxLon:131.2,minLat:33,maxLat:38.7 };
const project = ([lon,lat]) => [((lon-bounds.minLon)/(bounds.maxLon-bounds.minLon))*520,((bounds.maxLat-lat)/(bounds.maxLat-bounds.minLat))*650];

function decodeTopology(topology){
  const {scale,translate}=topology.transform;
  const decoded=topology.arcs.map(arc=>{let x=0,y=0;return arc.map(([dx,dy])=>{x+=dx;y+=dy;return[x*scale[0]+translate[0],y*scale[1]+translate[1]]})});
  const arc=index=>index<0?[...decoded[~index]].reverse():decoded[index];
  const ring=indexes=>indexes.flatMap((index,position)=>{const points=arc(index);return position?points.slice(1):points});
  const polygonPaths=arcs=>arcs.map(indexes=>ring(indexes));
  const collection=Object.values(topology.objects).find(object=>object.type==='GeometryCollection');
  return collection.geometries.map(geometry=>{
    const polygons=geometry.type==='Polygon'?[polygonPaths(geometry.arcs)]:geometry.arcs.map(polygonPaths);
    const allPoints=polygons.flat(2);
    const projected=polygons.map(polygon=>polygon.map(points=>points.map(project)));
    const path=projected.map(polygon=>polygon.map(points=>points.length?`M${points.map(point=>point.map(value=>value.toFixed(1)).join(',')).join('L')}Z`:``).join(' ')).join(' ');
    const projectedPoints=allPoints.map(project);const center=projectedPoints.reduce((sum,point)=>[sum[0]+point[0],sum[1]+point[1]],[0,0]).map(value=>value/Math.max(1,projectedPoints.length));
    return {code:geometry.properties.code,name:provinceNames[geometry.properties.code]||geometry.properties.name_eng,path,center};
  })
}

export default function KoreaMap({places,selectedPlace,onSelect,currentPosition}){
  const [features,setFeatures]=useState([]),[status,setStatus]=useState('loading'),[activeProvince,setActiveProvince]=useState(null);
  useEffect(()=>{fetch('/data/korea-provinces-topo.json').then(response=>{if(!response.ok)throw new Error('map');return response.json()}).then(data=>{setFeatures(decodeTopology(data));setStatus('ready')}).catch(()=>setStatus('error'))},[]);
  const koreaPlaces=useMemo(()=>places.filter(place=>place.region==='대한민국'),[places]);
  const counts=useMemo(()=>koreaPlaces.reduce((result,place)=>{const code=cityToCode[place.city]||'';result[code]=(result[code]||0)+place.recordings.length;return result},{}),[koreaPlaces]);
  const activeName=activeProvince?provinceNames[activeProvince]:null;
  if(status==='loading')return <div className="korea-map-state"><i/><span>대한민국 시·도 경계를 불러오는 중…</span></div>;
  if(status==='error')return <div className="korea-map-state error"><b>지도를 불러오지 못했어요.</b><button onClick={()=>location.reload()}>다시 시도</button></div>;
  return <div className="korea-map-stage">
    <header><div><p>대한민국 상세 지도</p><h2>{activeName||'전국의 소리 기록'}</h2><span>{activeProvince?`${counts[activeProvince]||0}개의 녹음`:`${koreaPlaces.length}개 장소 · ${koreaPlaces.reduce((sum,place)=>sum+place.recordings.length,0)}개 녹음`}</span></div>{activeProvince&&<button onClick={()=>setActiveProvince(null)}>전국 보기</button>}</header>
    <div className="korea-map-canvas"><svg viewBox="0 0 520 650" role="img" aria-label="대한민국 시도 지도">
      <g>{features.map(feature=><path key={feature.code} d={feature.path} className={`korea-province ${activeProvince===feature.code?'active':''} ${counts[feature.code]?'has-records':''}`} onClick={()=>setActiveProvince(feature.code)}><title>{feature.name} · 녹음 {counts[feature.code]||0}개</title></path>)}</g>
      <g className="province-labels">{features.filter(feature=>!['21','22','23','24','25','26','29'].includes(feature.code)).map(feature=><text key={feature.code} x={feature.center[0]} y={feature.center[1]}>{feature.name}</text>)}</g>
    </svg>
      {koreaPlaces.map(place=>{const [x,y]=project([place.longitude,place.latitude]);const code=cityToCode[place.city]||'';if(activeProvince&&activeProvince!==code)return null;return <button key={place.key} className={`korea-place-marker ${selectedPlace===place.key?'active':''}`} style={{left:`${x/520*100}%`,top:`${y/650*100}%`}} onClick={()=>onSelect(place)}><i/><b>{place.recordings.length}</b><span>{place.city}</span></button>})}
      {currentPosition&&currentPosition.longitude>=bounds.minLon&&currentPosition.longitude<=bounds.maxLon&&currentPosition.latitude>=bounds.minLat&&currentPosition.latitude<=bounds.maxLat&&(()=>{const[x,y]=project([currentPosition.longitude,currentPosition.latitude]);return <span className="korea-current-location" style={{left:`${x/520*100}%`,top:`${y/650*100}%`}}><i/></span>})()}
    </div>
    <footer><span><i className="legend-record"/>소리 기록</span><span><i className="legend-current"/>현재 위치</span><a href="https://github.com/southkorea/southkorea-maps" target="_blank" rel="noreferrer">경계 데이터: KOSTAT · southkorea-maps</a></footer>
  </div>
}
