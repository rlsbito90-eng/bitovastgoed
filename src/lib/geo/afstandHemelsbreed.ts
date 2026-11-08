/** Haversine tussen twee geverifieerde WGS84-locaties, in kilometers.
 * Zonder valide coördinaten GEEN afstandsclaim; reistijden volgen een andere route.
 */
export function afstandHemelsbreedKm(a:{lat:number;lon:number},b:{lat:number;lon:number}):number|null{
  const geldig=(x:{lat:number;lon:number})=>
    Number.isFinite(x.lat)&&Number.isFinite(x.lon)&&
    x.lat>=-90&&x.lat<=90&&x.lon>=-180&&x.lon<=180;
  if(!geldig(a)||!geldig(b))return null;
  const rad=Math.PI/180,dlat=(b.lat-a.lat)*rad,dlon=(b.lon-a.lon)*rad;
  const hav=Math.sin(dlat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dlon/2)**2;
  return 6371.0088*2*Math.asin(Math.min(1,Math.sqrt(Math.max(0,hav))));
}
