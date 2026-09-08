/** Authored space vistas for the copied flight frame. Original procedural
 * materials with an optional user-supplied Earth map; no simulation objects or clocks.
 * Rays, spheres and ring planes share one world coordinate system, so nearby
 * material passes the camera while distant moons retain their slower parallax.
 */
export const VOYAGE_SHADER = `
// These envelopes come from real gameplay. They displace existing material;
// there is no oscillator driving a scene-wide light gain and no reward clock.
float voyageFront(float radius,float envelope,float start,float span,float width){
  float phase=uVoyageCue.z>0.5?1.0-envelope:0.36;
  float d=(radius-(start+span*phase))/width;
  return exp(-d*d)*envelope;
}
vec2 voyageResponsePosition(vec2 pixel,vec2 size){
  if(uVoyageCue.z<0.5)return pixel;
  vec2 p=(pixel-uOuterCenter)/size.y;float r=length(p);
  vec2 normal=p/max(r,0.001);
  float hole=uVoyageForce.z;
  if(hole>0.001){
    float pull=hole*exp(-r*3.8),a=pull*0.62;
    p=mat2(cos(a),-sin(a),sin(a),cos(a))*p*(1.0+pull*0.24);
    return uOuterCenter+p*size.y;
  }
  float orbit=voyageFront(r,uVoyagePower.y,0.10,0.70,0.038);
  float release=voyageFront(r,uVoyagePower.z,0.08,1.08,0.115);
  float twist=uVoyagePower.x*0.027*exp(-r*1.8);
  p=mat2(cos(twist),-sin(twist),sin(twist),cos(twist))*p;
  p+=normal*(orbit*0.018+release*0.043);
  vec2 local=(pixel-uVoyageCue.xy)/size.y;
  p+=local*uVoyageForce.x*0.19*exp(-dot(local,local)*23.0);
  return uOuterCenter+p*size.y;
}
vec3 voyageResponseColor(vec3 color,vec2 pixel,vec2 size){
  float r=length((pixel-uOuterCenter)/size.y);
  if(uVoyageForce.z>0.001)return color*(1.0-uVoyageForce.z*0.36*exp(-r*3.6));
  float release=voyageFront(r,uVoyagePower.z,0.08,1.08,0.115);
  float orbit=voyageFront(r,uVoyagePower.y,0.10,0.70,0.038);
  float light=max(0.07,dot(color,vec3(0.26,0.58,0.16)));
  color=mix(color,vec3(1.0,0.70,0.22)*light*1.35,release*0.60);
  color=mix(color,vec3(0.20,0.83,0.97)*light*1.20,orbit*0.34);
  vec2 local=(pixel-uVoyageCue.xy)/size.y;
  float heat=uVoyageForce.y*exp(-dot(local,local)*38.0);
  return mix(color,vec3(0.92,0.29,0.07)*light*1.25,heat*0.52);
}
vec3 voyageSurfaceResponse(vec3 color,vec3 n){
  float front=voyageFront(n.y,uVoyagePower.z,-0.96,1.92,0.19);
  float orbit=voyageFront(n.y,uVoyagePower.y,-0.94,1.88,0.085);
  float light=max(0.10,dot(color,vec3(0.26,0.58,0.16)));
  color=mix(color,vec3(0.30,0.84,0.80)*light*1.35,uVoyagePower.x*0.11);
  color=mix(color,vec3(0.24,0.79,0.97)*light*1.30,orbit*0.42);
  return mix(color,vec3(1.0,0.72,0.27)*light*1.45,front*0.72);
}
float voyageHash(vec3 p){
  p=fract(p*0.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);
}
float voyageNoise(vec3 p){
  vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
  return mix(mix(mix(voyageHash(i),voyageHash(i+vec3(1,0,0)),f.x),
    mix(voyageHash(i+vec3(0,1,0)),voyageHash(i+vec3(1,1,0)),f.x),f.y),
    mix(mix(voyageHash(i+vec3(0,0,1)),voyageHash(i+vec3(1,0,1)),f.x),
    mix(voyageHash(i+vec3(0,1,1)),voyageHash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float voyageFbm(vec3 p){
  float f=0.0,a=0.54;
  for(int i=0;i<4;i++){f+=voyageNoise(p)*a;p=p*2.03+vec3(7.1,3.7,9.2);a*=0.48;}
  return f;
}
float voyageSphere(vec3 ro,vec3 rd,vec3 center,float radius){
  vec3 oc=ro-center;float b=dot(oc,rd),c=dot(oc,oc)-radius*radius;
  float d=b*b-c;if(d<0.0)return -1.0;
  float near=-b-sqrt(d),far=-b+sqrt(d);return near>0.0?near:(far>0.0?far:-1.0);
}
vec3 voyageStars(vec2 uv,float scale,float gain){
  vec2 cell=floor(uv*scale),f=fract(uv*scale);
  float h=voyageHash(vec3(cell,17.8));
  vec2 pos=vec2(voyageHash(vec3(cell,3.1)),voyageHash(vec3(cell,8.6)));
  vec2 delta=f-pos;float d=dot(delta,delta);
  float light=exp(-d*850.0)*step(0.67,h)+exp(-d*80.0)*step(0.974,h)*0.22;
  return mix(vec3(0.49,0.67,0.95),vec3(0.98,0.88,0.72),h)*light*gain;
}
float voyageCraters(vec3 n){
  vec2 uv=vec2(atan(n.z,n.x),asin(clamp(n.y,-1.0,1.0)))*5.5;
  vec2 cell=floor(uv);float rock=0.94;
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
    vec2 id=cell+vec2(float(x),float(y));
    vec2 center=id+vec2(voyageHash(vec3(id,2.7)),voyageHash(vec3(id,8.4)));
    vec2 delta=uv-center;float size=0.16+voyageHash(vec3(id,4.1))*0.25;
    float r=length(delta)/size;
    float bowl=1.0-smoothstep(0.24,1.0,r),rim=exp(-pow((r-1.0)*6.0,2.0));
    float edge=dot(delta/max(length(delta),0.001),vec2(-0.65,0.76));
    rock+=rim*(0.08+edge*0.16)-bowl*0.18;
  }
  return rock;
}
float voyageRingDensity(float r){
  float orbit=voyageFront(r,uVoyagePower.y,1.60,1.65,0.12);
  float release=voyageFront(r,uVoyagePower.z,1.60,1.65,0.26);
  r+=(uVoyagePower.x*sin(r*8.0)*0.023+orbit*0.038+release*0.092)*uVoyageCue.z;
  float edge=smoothstep(1.60,1.66,r)*(1.0-smoothstep(3.20,3.29,r));
  float bands=0.63+0.20*sin(r*91.0)+0.11*sin(r*217.0)+0.06*sin(r*487.0);
  float division=1.0-0.92*(smoothstep(2.49,2.52,r)*(1.0-smoothstep(2.58,2.60,r)));
  return edge*bands*division;
}
vec3 voyageSurface(vec3 n,float chapter,float time){
  float turn=uVoyagePower.x*0.095*uVoyageCue.z;
  n.xz=mat2(cos(turn),-sin(turn),sin(turn),cos(turn))*n.xz;
  float orbit=voyageFront(n.y,uVoyagePower.y,-0.94,1.88,0.085);
  n=normalize(n+vec3(0.0,orbit*0.023*uVoyageCue.z,0.0));
  if(chapter>5.5&&chapter<6.5){
    float terrain=voyageFbm(n*6.0);
    vec3 stone=mix(vec3(0.30,0.25,0.23),vec3(0.75,0.63,0.50),terrain);
    return voyageSurfaceResponse(stone*voyageCraters(n),n);
  }
  if(chapter>6.5&&chapter<7.5){
    float cloud=voyageFbm(n*5.0+vec3(n.y*2.4,0.0,0.0));
    float folds=0.5+0.5*sin(n.y*18.0+cloud*10.0);
    return voyageSurfaceResponse(mix(vec3(0.63,0.42,0.17),vec3(0.98,0.87,0.61),cloud*0.66+folds*0.34),n);
  }
  if(chapter>7.5&&chapter<8.5){
    float terrain=voyageFbm(n*4.7+vec3(8.1,2.4,0.0));
    vec3 rust=mix(vec3(0.27,0.10,0.055),vec3(0.84,0.40,0.18),smoothstep(0.23,0.70,terrain));
    rust=mix(rust,vec3(0.85,0.78,0.64),smoothstep(0.89,0.98,abs(n.y)));
    return voyageSurfaceResponse(rust,n);
  }
  if(chapter>8.5&&chapter<9.5){
    float bands=0.52+0.21*sin(n.y*26.0+voyageFbm(n*10.0)*1.3)+0.075*sin(n.y*73.0);
    vec3 clouds=mix(vec3(0.52,0.27,0.13),vec3(0.98,0.90,0.72),bands);
    vec2 storm=(n.xy-vec2(-0.40,-0.26))*vec2(6.0,13.0);
    clouds=mix(clouds,vec3(0.66,0.23,0.095),(1.0-smoothstep(0.45,1.0,length(storm)))*0.80);
    return voyageSurfaceResponse(clouds,n);
  }
  if(chapter>10.5&&chapter<11.5){
    float mineral=voyageFbm(n*5.0);
    float veins=pow(1.0-abs(sin(mineral*28.0+n.z*3.0)),14.0);
    return voyageSurfaceResponse(mix(vec3(0.15,0.07,0.29),vec3(0.39,0.32,0.64),smoothstep(0.25,0.73,mineral))
      +vec3(0.07,0.49,0.54)*veins*0.46,n);
  }
  if(chapter>11.5){
    float stone=voyageFbm(n*7.0);
    float channels=pow(1.0-abs(sin(stone*28.0)),7.0);
    return voyageSurfaceResponse(mix(vec3(0.13,0.045,0.17),vec3(0.44,0.15,0.18),stone)
      +vec3(0.83,0.34,0.11)*channels*0.46,n);
  }
  if(chapter>9.5){
    float mist=0.58+0.13*sin(n.y*12.0)+0.12*voyageFbm(n*7.0);
    return voyageSurfaceResponse(mix(vec3(0.19,0.51,0.55),vec3(0.59,0.89,0.86),mist),n);
  }
  if(chapter<0.5){
    float latitude=n.y+0.018*voyageFbm(n*19.0);
    float bands=0.55+0.17*sin(latitude*28.0)+0.09*sin(latitude*71.0)+0.035*sin(latitude*151.0);
    vec3 color=mix(vec3(0.48,0.34,0.19),vec3(1.0,0.87,0.63),bands);
    return voyageSurfaceResponse(color*(0.88+0.16*voyageFbm(n*25.0)),n);
  }
  if(chapter<2.5){
    vec3 continent=n*3.15+vec3(2.8,0.7,4.9);
    float land=voyageFbm(continent)+0.075*voyageNoise(n*14.0);
    float coast=smoothstep(0.49,0.54,land);
    vec3 earth=mix(vec3(0.018,0.15,0.47),mix(vec3(0.13,0.35,0.15),vec3(0.58,0.48,0.29),
      smoothstep(0.55,0.76,land)),coast);
    float ice=smoothstep(0.78,0.96,abs(n.y));earth=mix(earth,vec3(0.75,0.86,0.91),ice);
    if(uVoyageEarthReady>0.5){
      // The unflipped upload keeps the image's north/top row at v=0. Longitude
      // wraps in the shader so the user's non-power-of-two map needs no repeat.
      vec2 mapUv=vec2(fract(atan(n.x,n.z)/6.28318530718+0.5),
        0.5-asin(clamp(n.y,-1.0,1.0))/3.14159265359);
      earth=texture2D(uVoyageEarth,mapUv).rgb;
    }
    float clouds=smoothstep(0.58,0.76,voyageFbm(n*7.0+vec3(time*0.0007,0.0,0.0)));
    return voyageSurfaceResponse(mix(earth,vec3(0.84,0.90,0.96),clouds*0.88),n);
  }
  if(chapter<3.5){
    float bands=0.5+0.18*sin(n.y*32.0+voyageNoise(n*8.0)*1.8)+0.1*sin(n.y*94.0);
    vec3 ice=mix(vec3(0.018,0.07,0.24),vec3(0.15,0.49,0.78),bands);
    float storm=exp(-length((n.xy-vec2(-0.36,-0.18))*vec2(8.0,19.0)));
    return voyageSurfaceResponse(ice*(1.0-storm*0.63),n);
  }
  float continents=voyageFbm(n*4.5+vec3(11.0,4.0,7.0));
  float seams=pow(1.0-abs(sin(continents*29.0)),10.0);
  vec3 stone=mix(vec3(0.10,0.025,0.20),vec3(0.34,0.15,0.45),continents);
  return voyageSurfaceResponse(stone+vec3(0.06,0.68,0.52)*seams*0.65,n);
}
vec4 voyageMoon(vec3 ro,vec3 rd,vec3 center,float radius,vec3 tint,vec3 sun,float nearest,vec3 color){
  float t=voyageSphere(ro,rd,center,radius);
  if(t<=0.0||(nearest>0.0&&t>nearest))return vec4(color,nearest);
  vec3 n=normalize(ro+rd*t-center);
  float rock=0.70+0.30*voyageFbm(n*12.0);
  float crater=voyageNoise(n*34.0);rock*=0.72+0.28*smoothstep(0.17,0.42,crater);
  float light=0.12+0.96*max(0.0,dot(n,sun));
  return vec4(tint*rock*light,t);
}
vec3 voyageNebula(vec2 uv,vec3 rd,float progress,float time,float chapter){
  vec3 color=vec3(0.006,0.009,0.029);
  for(int i=0;i<3;i++){
    float layer=float(i),depth=0.72+layer*0.78;
    vec3 q=vec3(uv*depth*3.0+vec2(progress*(0.85+layer*0.34),-progress*0.26),
      5.0+layer*2.7+time*0.0014);
    q.xy+=vec2(-uv.y,uv.x)*uVoyagePower.x*0.26*uVoyageCue.z;
    float warp=voyageFbm(q*0.74+vec3(2.1,5.6,0.0));
    float cloud=voyageFbm(q+vec3(warp*1.7,-warp*1.1,0.0));
    float fold=pow(max(0.0,1.0-abs(cloud*2.0-1.03)),3.2);
    float voids=0.20+0.80*smoothstep(0.12,0.62,voyageFbm(q*0.51+4.0));
    vec3 hue=mix(vec3(0.42,0.08,0.68),vec3(0.12,0.62,0.76),smoothstep(0.36,0.62,cloud));
    if(chapter>3.5)hue=mix(vec3(0.37,0.16,0.06),vec3(0.51,0.32,0.17),cloud);
    color+=hue*fold*voids*(0.85-layer*0.17);
  }
  color+=voyageStars(rd.xy/abs(rd.z)*0.5,130.0,0.85);
  color+=voyageStars(rd.xy/abs(rd.z)*0.5+0.27,52.0,0.60);
  return color;
}
vec4 paintVoyage(vec2 pixel,vec2 size,vec3 voyage){
  float progress=clamp(voyage.x,0.0,1.0),chapter=voyage.y,time=voyage.z;
  vec2 uv=(pixel-vec2(size.x*0.5,size.y*0.52))/size.y;uv.y=-uv.y;
  float side=chapter<0.5?-1.65:(chapter<2.5?1.32:-1.46);
  // Most of the chapter belongs to the encounter. The later bend passes the
  // ring plane, then a closer moon takes over the departure rather than void.
  float route=pow(progress,1.18);
  float height=-2.35+1.51*smoothstep(0.0,0.60,progress);
  if(chapter>5.5&&chapter<6.5){side=-1.30;height=-0.70;}
  if(chapter>6.5&&chapter<7.5){side=1.42;height=-1.05;}
  if(chapter>7.5&&chapter<8.5){side=0.30+progress*0.55;height=-1.42;}
  if(chapter>8.5&&chapter<9.5){side=-1.88;height=-0.36-progress*0.46;}
  if(chapter>9.5&&chapter<10.5){side=1.57;height=-0.48-progress*0.80;}
  vec3 ro=vec3(side+sin(progress*3.14159)*0.27,height,10.6-route*14.2);
  vec3 forward=normalize(vec3(-side*0.040,0.025,-1.0));
  vec3 right=normalize(cross(forward,vec3(0,1,0))),up=cross(right,forward);
  vec3 rd=normalize(forward+right*uv.x*1.38+up*uv.y*1.38);
  if(chapter>0.5&&chapter<1.5)return vec4(voyageNebula(uv,rd,progress,time,chapter),0.40);
  if(chapter>3.5&&chapter<4.5){
    vec3 color=voyageNebula(uv,rd,progress,time,chapter)*0.75;
    vec2 center=vec2(0.10-progress*0.21,0.19);
    vec2 p=uv-center;float radius=0.072+0.075*sin(progress*3.14159);
    float r=length(p),a=atan(p.y,p.x);
    float lens=exp(-abs(r-radius*1.32)*70.0);
    vec2 disk=vec2(p.x,p.y*4.9+p.x*0.20);float dr=length(disk);
    float accretion=exp(-abs(dr-radius*2.1)*28.0)*(0.68+0.20*sin(dr*220.0+a*2.0));
    color+=vec3(0.64,0.32,0.10)*accretion*0.60+vec3(0.55,0.38,0.21)*lens*0.38;
    color*=smoothstep(radius*0.90,radius*1.04,r);
    return vec4(color,0.76);
  }
  // Space between the bodies is transparent: the original living nebula,
  // orbit-earned palettes, musical movement and powers remain visible.
  vec3 color=vec3(0.0);float coverage=0.0;
  // Light the hemisphere actually seen along each route. This is authored
  // composition: the flyby must reveal a world, not spend it on its night side.
  vec3 sun=normalize(vec3(chapter>1.5&&chapter<2.5?0.65:-0.43,0.12,1.35));
  float radius=chapter<0.5?1.31:(chapter<2.5?1.22:(chapter<3.5?1.28:1.23));
  if(chapter>5.5&&chapter<6.5)radius=1.20;
  if(chapter>6.5&&chapter<7.5)radius=1.21;
  if(chapter>7.5&&chapter<8.5)radius=1.10;
  if(chapter>8.5&&chapter<9.5)radius=1.52;
  if(chapter>9.5)radius=1.26;
  float sphere=voyageSphere(ro,rd,vec3(0),radius);
  vec3 ringNormal=normalize(vec3(0.20,0.72,0.66));
  if(chapter>9.5)ringNormal=normalize(vec3(0.84,0.17,0.53));
  float ringDen=dot(rd,ringNormal);
  float ringT=abs(ringDen)>0.0001?-dot(ro,ringNormal)/ringDen:-1.0;
  vec3 ringPoint=ro+rd*ringT;float ringRadius=length(ringPoint);
  bool rings=chapter<0.5||(chapter>4.5&&chapter<5.5)||chapter>9.5;
  float ringAlpha=rings&&ringT>0.0?voyageRingDensity(ringRadius):0.0;
  if(chapter>9.5)ringAlpha*=0.30;
  if(sphere>0.0){
    vec3 p=ro+rd*sphere,n=normalize(p);float diffuse=max(0.0,dot(n,sun));
    if(rings){
      float shadowT=-dot(p,ringNormal)/dot(sun,ringNormal);
      float shadowR=length(p+sun*shadowT);
      if(shadowT>0.0)diffuse*=1.0-voyageRingDensity(shadowR)*0.68;
    }
    color=voyageSurface(n,chapter,time)*(0.19+diffuse*1.03);coverage=1.0;
    vec3 atmosphere=chapter<0.5?vec3(0.52,0.39,0.19):(chapter<2.5?vec3(0.07,0.35,0.88):
      (chapter<3.5?vec3(0.05,0.31,0.66):vec3(0.27,0.11,0.54)));
    if(chapter>5.5&&chapter<6.5)atmosphere=vec3(0.008,0.007,0.006);
    if(chapter>6.5&&chapter<7.5)atmosphere=vec3(0.52,0.34,0.11);
    if(chapter>7.5&&chapter<8.5)atmosphere=vec3(0.39,0.14,0.035);
    if(chapter>8.5&&chapter<9.5)atmosphere=vec3(0.44,0.31,0.14);
    if(chapter>9.5)atmosphere=vec3(0.10,0.45,0.50);
    float limb=pow(1.0-max(0.0,dot(n,-rd)),3.2);
    color+=atmosphere*limb*(0.17+diffuse*0.57);
  }else{
    float closest=length(cross(-ro,rd));
    if(dot(-ro,rd)>0.0){
      float halo=exp(-max(0.0,closest-radius)*24.0);
      vec3 haloColor=chapter>1.5&&chapter<2.5?vec3(0.035,0.30,0.95):vec3(0.18,0.30,0.43);
      if(chapter>5.5&&chapter<6.5)haloColor=vec3(0.006);
      coverage=halo*0.32;
      color=haloColor*1.15;
    }
  }
  float nearest=sphere;
  vec3 moonCenter=chapter<0.5?vec3(-1.20,-0.22,-6.25):vec3(1.60,-0.34,-6.40);
  vec3 moonTint=chapter<0.5?vec3(0.88,0.65,0.37):vec3(0.79,0.82,0.86);
  // Resolve opaque surfaces with their actual hit distances. A ring's alpha
  // must never act as an opaque depth test against a moon seen through it.
  vec4 body=vec4(color,nearest);
  bool hasMoon=chapter<0.5||(chapter>1.5&&chapter<3.5)||(chapter>4.5&&chapter<5.5)||chapter>7.5;
  if(hasMoon){
    body=voyageMoon(ro,rd,moonCenter,chapter<0.5?0.38:0.33,moonTint,sun,nearest,color);
    color=body.rgb;nearest=body.a;
  }
  if(chapter<0.5){
    body=voyageMoon(ro,rd,vec3(3.75,-0.20,-1.4),0.16,vec3(0.57,0.63,0.66),sun,nearest,color);
    color=body.rgb;nearest=body.a;
    // A handful of real world-space ring fragments. Their small unlit slate
    // surfaces provide close parallax without resembling gold game pickups.
    for(int i=0;i<7;i++){
      float id=float(i),angle=id*0.897+0.48,r=2.10+fract(id*0.713)*0.80;
      vec3 rock=vec3(cos(angle)*r,0.0,sin(angle)*r);
      rock.y=-(rock.x*ringNormal.x+rock.z*ringNormal.z)/ringNormal.y;
      body=voyageMoon(ro,rd,rock,0.019+fract(id*0.381)*0.024,
        vec3(0.34,0.36,0.39),sun,nearest,color);
      color=body.rgb;nearest=body.a;
    }
  }
  if(nearest>0.0)coverage=1.0;
  if(ringAlpha>0.001&&(nearest<0.0||ringT<nearest)){
    float shadow=voyageSphere(ringPoint+sun*0.02,sun,vec3(0),radius)>0.0?0.17:1.0;
    vec3 ringColor=mix(vec3(0.58,0.43,0.26),vec3(0.96,0.84,0.61),smoothstep(1.7,3.1,ringRadius));
    if(chapter>4.5)ringColor=mix(vec3(0.16,0.24,0.40),vec3(0.35,0.66,0.61),ringAlpha);
    float sweep=voyageFront(ringRadius,uVoyagePower.z,1.60,1.65,0.26);
    float ripple=voyageFront(ringRadius,uVoyagePower.y,1.60,1.65,0.12);
    ringColor=mix(ringColor,vec3(0.32,0.82,0.94),ripple*0.37);
    ringColor=mix(ringColor,vec3(1.0,0.76,0.34),sweep*0.70);
    float grain=0.91+0.09*voyageNoise(ringPoint*90.0);
    float alpha=ringAlpha*0.98;
    float composed=alpha+coverage*(1.0-alpha);
    color=(color*coverage*(1.0-alpha)+ringColor*shadow*grain*(0.86+0.16*abs(dot(sun,ringNormal)))*alpha)/max(composed,0.0001);
    coverage=composed;
  }
  return vec4(color,coverage);
}
`;
