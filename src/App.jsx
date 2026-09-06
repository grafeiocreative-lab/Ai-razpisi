import { useState, useEffect, useRef } from "react";
import {
  LayoutGrid,FileText,User,Bell,Calendar,Bot,Search,
  ChevronRight,ChevronDown,X,ExternalLink,Bookmark,Check,Filter,
  BarChart3,Globe,MapPin,Building2,TrendingUp,
  Zap,Shield,Loader2,ArrowRight,Cpu,Leaf,FlaskConical,Users,
  Building,GraduationCap,ChevronLeft,Pencil,Timer,Eye,Lock,
  Layers,MessageSquare,BellRing,Database,FileSearch,ArrowUpRight,
  Minus,CircleCheck,CircleX,ChevronUp,
} from "lucide-react";
import{createClient}from"@supabase/supabase-js";
const sb=import.meta.env.VITE_SUPABASE_URL
  ?createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_ANON_KEY,{db:{schema:"ai_razpisi"}})
  :null;

/* ═══ TOKENS ═══════════════════════════════════════ */
const c={graphite:"#071014",ivory:"#F7F4EC",cream:"#EFEADF",olive:"#7F9656",oliveLight:"rgba(127,150,86,0.08)",oliveMed:"rgba(127,150,86,0.15)",amber:"#D9A441",amberLight:"rgba(217,164,65,0.12)",border:"#DDD7C8",t1:"#101418",t2:"#62645F",t3:"#8A8A82",white:"#FFFFFF",signal:"#5B7CFA",signalLight:"rgba(91,124,250,0.12)",coral:"#C85A3A"};
const f="'Inter',system-ui,-apple-system,sans-serif";
// Serif za "uradni" register (citati iz razpisov, glavni naslov), sans za "človeški" prevod.
// Ista logika kot produkt sam: uradno besedilo prevedemo v razumljivega.
const fSerif="'Newsreader',Georgia,serif";
// Konsistenten radius/spacing sistem — glavne površine 12-14, sekundarne 8-10, majhni elementi 6-8.
// Pill (999) samo za semantične oznake (status/filter), ne kot privzet element.
const radius={lg:14,md:10,sm:8,xs:6,pill:999};
const tnum={fontVariantNumeric:"tabular-nums"};

function useIsMobile(){
  const get=()=>typeof window!=="undefined"&&window.matchMedia("(max-width: 760px)").matches;
  const[isMobile,setIsMobile]=useState(get);
  useEffect(()=>{if(typeof window==="undefined")return;const mq=window.matchMedia("(max-width: 760px)");const on=()=>setIsMobile(mq.matches);on();mq.addEventListener?.("change",on);return()=>mq.removeEventListener?.("change",on);},[]);
  return isMobile;
}

function usePrefersReducedMotion(){
  const get=()=>typeof window!=="undefined"&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const[reduced,setReduced]=useState(get);
  useEffect(()=>{if(typeof window==="undefined")return;const mq=window.matchMedia("(prefers-reduced-motion: reduce)");const on=()=>setReduced(mq.matches);on();mq.addEventListener?.("change",on);return()=>mq.removeEventListener?.("change",on);},[]);
  return reduced;
}

function useIsCompact(){
  // Vmesna širina med mobilno postavitvijo in polnim namiznim 3-stolpčnim prikazom
  // (sidebar + seznam + detajlni panel). Pod tem pragom detajlni panel postane
  // prekrivni sloj namesto trdega tretjega stolpca, da se seznam ne stisne na 0.
  const get=()=>typeof window!=="undefined"&&window.matchMedia("(max-width: 1240px)").matches;
  const[compact,setCompact]=useState(get);
  useEffect(()=>{if(typeof window==="undefined")return;const mq=window.matchMedia("(max-width: 1240px)");const on=()=>setCompact(mq.matches);on();mq.addEventListener?.("change",on);return()=>mq.removeEventListener?.("change",on);},[]);
  return compact;
}

/* ═══ SISTEMSKI PRIMITIVI (design sistem) ═══════════ */
// Status: pika + oznaka, namesto velikega pastelnega badgea.
function Status({ok,label}){
  const col=ok===true?c.olive:ok===false?c.coral:c.t3;
  return(<span style={{display:"inline-flex",alignItems:"center",gap:7,fontSize:12,fontWeight:600,color:col,fontFamily:f,whiteSpace:"nowrap"}}><span style={{width:7,height:7,borderRadius:"50%",background:col,flexShrink:0}}/>{label}</span>);
}

// Score: odstotek ujemanja kot številka + tanka skala, ne velik krožni gauge.
function Score({value,size="sm"}){
  const label=value>=80?"Visoko ujemanje":value>=60?"Srednje ujemanje":"Nizko ujemanje";
  const col=value>=80?c.olive:value>=60?c.amber:c.t3;
  const lg=size==="lg";
  return(<div style={{display:"flex",flexDirection:"column",gap:7,minWidth:0}}>
    <div style={{display:"flex",alignItems:"baseline",gap:8,flexWrap:"wrap"}}>
      <span style={{fontSize:lg?32:17,fontWeight:800,color:c.t1,lineHeight:1,...tnum}}>{value}%</span>
      {lg&&<span style={{fontSize:11,fontWeight:700,letterSpacing:".04em",color:col,textTransform:"uppercase"}}>{label}</span>}
    </div>
    <div style={{width:lg?150:60,maxWidth:"100%",height:3,borderRadius:2,background:`${c.t3}22`,overflow:"hidden"}}><div style={{width:`${value}%`,height:"100%",background:col}}/></div>
  </div>);
}

// DataRow / DataList: strukturirani podatki podjetja kot definicijski seznam, ne kartica na vrednost.
function DataRow({label,value}){
  return(<div style={{display:"flex",gap:16,padding:"10px 0",borderBottom:`1px solid ${c.border}40`,fontSize:13}}>
    <span style={{color:c.t3,minWidth:130,flexShrink:0}}>{label}</span>
    <span style={{color:c.t1,fontWeight:500,flex:1,minWidth:0,wordBreak:"break-word",textAlign:"right",...tnum}}>{value}</span>
  </div>);
}
function DataList({rows}){
  return(<div>{rows.map(([l,v])=><DataRow key={l} label={l} value={v}/>)}</div>);
}

// Uradni razpis → AI razlaga: podpisni element aplikacije (dokument → razumljiva informacija).
function DocumentQuote({source,cite,children}){
  return(<div style={{borderLeft:`3px solid ${c.coral}`,paddingLeft:16}}>
    <div style={{fontSize:10,fontWeight:700,letterSpacing:".08em",color:c.coral,marginBottom:8,textTransform:"uppercase",fontFamily:f}}>{source||"Uradni vir"}</div>
    <div style={{fontSize:14,lineHeight:1.7,color:c.t2,fontStyle:"italic",fontFamily:fSerif}}>{children}</div>
    {cite&&<div style={{fontSize:11,color:c.t3,marginTop:8,fontFamily:f}}>{cite}</div>}
  </div>);
}
function AIExplanation({label,facts,children}){
  return(<div style={{borderLeft:`3px solid ${c.olive}`,paddingLeft:16}}>
    <div style={{fontSize:10,fontWeight:700,letterSpacing:".08em",color:c.olive,marginBottom:8,textTransform:"uppercase",fontFamily:f}}>{label||"AI razlaga"}</div>
    <div style={{fontSize:14,lineHeight:1.65,color:c.t1,whiteSpace:"pre-line",fontFamily:f}}>{children}</div>
    {facts&&facts.length>0&&<div style={{display:"flex",flexDirection:"column",gap:5,marginTop:10}}>{facts.map((fi,i)=><div key={i} style={{fontSize:12,color:c.t2}}><strong style={{color:c.t1,fontWeight:700,...tnum}}>{fi.k}</strong>{fi.v?` ${fi.v}`:""}</div>)}</div>}
  </div>);
}
function DocumentTransition({quote,quoteCite,quoteSource,explanation,explanationLabel,facts}){
  return(<div style={{display:"flex",flexDirection:"column",gap:16}}>
    <DocumentQuote source={quoteSource} cite={quoteCite}>{quote}</DocumentQuote>
    <div style={{display:"flex",alignItems:"center",gap:8,color:c.t3,fontSize:10,fontWeight:700,letterSpacing:".06em",paddingLeft:16}}>PREVEDENO</div>
    <AIExplanation label={explanationLabel} facts={facts}>{explanation}</AIExplanation>
  </div>);
}

/* ═══ SHARED NAV ═══════════════════════════════════ */
function Nav({page,go,onStart,overlay=false}){
  const isMobile=useIsMobile();
  const[scrolled,setScrolled]=useState(!overlay);
  useEffect(()=>{
    if(!overlay)return;
    const onScroll=()=>setScrolled(window.scrollY>60);
    onScroll();
    window.addEventListener("scroll",onScroll,{passive:true});
    return()=>window.removeEventListener("scroll",onScroll);
  },[overlay]);
  const solid=!overlay||scrolled;
  const linkColor=solid?c.t2:"#F7F4ECb3";
  const logoColor=solid?c.t1:"#F7F4EC";
  return(
    <nav style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:isMobile?"14px 16px":"18px 40px",background:solid?`${c.white}cc`:"transparent",backdropFilter:solid?"blur(12px)":"none",borderBottom:solid?`1px solid ${c.border}50`:"1px solid transparent",transition:"background .3s ease, border-color .3s ease",position:overlay?"fixed":"sticky",top:0,left:0,right:0,zIndex:50,fontFamily:f}}>
      <div style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}} onClick={()=>go("landing")}>
        <div style={{width:36,height:36,borderRadius:10,background:c.olive,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:14,color:c.white}}>AI</div>
        <span style={{fontSize:18,fontWeight:700,color:logoColor,transition:"color .3s ease"}}>RAZPISI</span>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:isMobile?10:32}}>
        {[["kako","Kako deluje"],["cenik","Cenik"]].map(([k,l])=>(
          <a key={k} onClick={()=>go(k)} style={{display:isMobile&&k==="kako"?"none":"inline",fontSize:14,color:page===k?c.olive:linkColor,fontWeight:page===k?600:500,cursor:"pointer",textDecoration:"none",borderBottom:page===k?`2px solid ${c.olive}`:"2px solid transparent",paddingBottom:2,transition:"color .3s ease"}}>{l}</a>
        ))}
        <button onClick={onStart} style={{padding:isMobile?"8px 14px":"9px 22px",borderRadius:10,border:"none",background:solid?c.graphite:"rgba(127,150,86,0.82)",color:c.white,fontSize:isMobile?13:14,fontWeight:600,cursor:"pointer",fontFamily:f,whiteSpace:"nowrap",transition:"background .3s ease"}}>{isMobile?"Začni":"Začni brezplačno"}</button>
      </div>
    </nav>
  );
}

function Footer(){
  const isMobile=useIsMobile();
  return(
    <footer style={{borderTop:`1px solid ${c.border}`,padding:isMobile?"24px 16px":"32px 40px",display:"flex",flexDirection:isMobile?"column":"row",gap:10,justifyContent:"space-between",alignItems:"center",fontFamily:f}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:28,height:28,borderRadius:8,background:c.olive,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:10,color:c.white}}>AI</div><span style={{fontSize:14,fontWeight:600,color:c.t1}}>RAZPISI</span></div>
      <div style={{display:"flex",flexDirection:isMobile?"column":"row",alignItems:"center",gap:isMobile?6:20}}>
        <a href="mailto:grafeio.creative@gmail.com" style={{fontSize:12,color:c.t2,textDecoration:"none"}}>grafeio.creative@gmail.com</a>
        <span style={{fontSize:12,color:c.t3}}>© 2026 AI Razpisi · Slovenija</span>
      </div>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════ */
/*  HERO (video ozadje)                               */
/* ═══════════════════════════════════════════════════ */
function HeroVideo({go,onStart,grantCount}){
  const isMobile=useIsMobile();
  const reducedMotion=usePrefersReducedMotion();
  const trustItems=[grantCount!==null?`${grantCount} razpisov`:"Aktualni razpisi","AI ujemanje","Pod 2 min do pregleda"];
  // Mobile dobi namenski navpičen video (drug kader/crop), ne stisnjen desktop posnetek
  const videoBase=isMobile?"/hero/hero-mobile":"/hero/hero-desktop-v3";
  const posterSrc=isMobile?"/hero/hero-mobile-poster.jpg":"/hero/hero-poster.jpg";
  return(
    <section className="hero-fullscreen-section" style={{position:"relative",width:"100%",overflow:"hidden",display:"flex",alignItems:isMobile?"flex-start":"center"}}>
      {reducedMotion?(
        <img src={posterSrc} alt="" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",objectPosition:"50% center"}}/>
      ):(
        <video autoPlay muted loop playsInline preload="auto" poster={posterSrc} aria-hidden="true" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",objectPosition:"50% center"}}>
          <source src={`${videoBase}.webm`} type="video/webm"/>
          <source src={`${videoBase}.mp4`} type="video/mp4"/>
        </video>
      )}
      {/* Desktop: gradient samo čez levo stran. Mobile: močnejši overlay zgoraj (kjer je tekst), pojenja proti dnu. */}
      <div style={{position:"absolute",inset:0,background:isMobile
        ?"linear-gradient(180deg, rgba(20,22,18,0.68) 0%, rgba(20,22,18,0.50) 30%, rgba(20,22,18,0.38) 45%, rgba(20,22,18,0.16) 70%, rgba(20,22,18,0.05) 100%)"
        :"linear-gradient(90deg, rgba(24,24,19,0.64) 0%, rgba(24,24,19,0.43) 40%, rgba(24,24,19,0.12) 65%, rgba(24,24,19,0) 100%)"
      }}/>
      {/* Zelo kratek, pozno-nastopajoč prehod v naslednjo sekcijo — brez blura, samo opacity/barva,
          skoraj neopazen (fotografija ostane čista skoraj do roba). */}
      <div style={{position:"absolute",left:0,right:0,bottom:0,height:isMobile?32:36,background:`linear-gradient(180deg, transparent 0%, transparent 55%, ${c.ivory} 100%)`}}/>

      <div style={{position:"relative",zIndex:2,width:"100%",maxWidth:isMobile?"none":680,padding:isMobile?"calc(72px + env(safe-area-inset-top,0px)) 22px calc(28px + env(safe-area-inset-bottom,0px))":"0 clamp(32px,7vw,110px)"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:18}}>
          <span style={{width:5,height:5,borderRadius:"50%",background:"#AEC98C",flexShrink:0}}/>
          <span style={{fontSize:12,fontWeight:600,letterSpacing:".14em",textTransform:"uppercase",color:"#AEC98C"}}>AI platforma za slovenske razpise</span>
        </div>
        <h1 style={{fontFamily:fSerif,fontWeight:600,fontSize:isMobile?"clamp(42px,12vw,58px)":"clamp(36px,3.6vw,52px)",lineHeight:isMobile?1.02:1.16,color:"#F8F6EF",margin:isMobile?"0 0 18px":"0 0 20px"}}>Razpisi, ki ustrezajo<br/><span style={{color:"#C3DBA3"}}>vašemu podjetju.</span></h1>
        <p style={{fontSize:isMobile?16:18,lineHeight:isMobile?1.5:1.55,color:"#E4E1D6",maxWidth:540,margin:isMobile?"0 0 26px":"0 0 30px"}}>Vpišite matično številko. Sistem preveri vaše podjetje, de minimis prostor in pogoje razpisov ter izpostavi najbolj relevantne priložnosti.</p>
        <div style={{display:"flex",flexDirection:isMobile?"column":"row",flexWrap:"wrap",gap:isMobile?12:14,marginBottom:isMobile?28:30}}>
          <button onClick={onStart} className="hero-cta-primary" style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,height:isMobile?54:56,width:isMobile?"100%":"auto",padding:"0 30px",borderRadius:10,border:"none",background:c.olive,color:"#fff",fontSize:16,fontWeight:600,cursor:"pointer",fontFamily:f}}>Preveri razpise <ArrowRight size={18} className="hero-cta-arrow"/></button>
          <button onClick={()=>go("kako")} className="hero-cta-secondary" style={{display:"flex",alignItems:"center",justifyContent:"center",height:isMobile?52:56,width:isMobile?"100%":"auto",padding:"0 26px",borderRadius:10,border:"1.5px solid rgba(247,244,236,0.4)",background:"rgba(247,244,236,0.06)",color:"#F7F4EC",fontSize:16,fontWeight:600,cursor:"pointer",fontFamily:f}}>Kako deluje</button>
        </div>
        <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:isMobile?10:14,opacity:.72,fontSize:13,color:"#E7E4DA"}}>
          {trustItems.map((t,i)=>(
            <span key={t} style={{display:"flex",alignItems:"center",gap:isMobile?10:14}}>
              {i>0&&<span aria-hidden="true" style={{opacity:.6}}>•</span>}
              <span>{t}</span>
            </span>
          ))}
        </div>
      </div>
      <style>{`
        .hero-fullscreen-section{min-height:640px;min-height:100vh;min-height:100svh;min-height:100dvh;}
        .hero-cta-primary{transition:background .2s ease;}
        .hero-cta-primary:hover{background:#8FA968;}
        .hero-cta-primary:hover .hero-cta-arrow{transform:translateX(3px);}
        .hero-cta-arrow{transition:transform .2s ease;}
        .hero-cta-secondary{transition:background .2s ease,border-color .2s ease;}
        .hero-cta-secondary:hover{background:rgba(247,244,236,0.14);border-color:rgba(247,244,236,0.7);}
      `}</style>
    </section>
  );
}

/* ═══════════════════════════════════════════════════ */
/*  LANDING PAGE                                      */
/* ═══════════════════════════════════════════════════ */
function Landing({go,onStart}){
  const isMobile=useIsMobile();
  const sec={maxWidth:1080,margin:"0 auto",padding:isMobile?"0 16px":"0 32px"};
  const[grantCount,setGrantCount]=useState(null);
  useEffect(()=>{let active=true;(async()=>{const{count}=await sb.from("grants").select("id",{count:"exact",head:true}).in("status",["open","upcoming"]).ilike("source_url","http%");if(active&&typeof count==="number")setGrantCount(count);})();return()=>{active=false;};},[]);
  return(
    <div style={{fontFamily:f,color:c.t1,background:c.ivory}}>
      <Nav page="landing" go={go} onStart={onStart} overlay/>
      <HeroVideo go={go} onStart={onStart} grantCount={grantCount}/>

      {/* Uradni vir → AI razlaga: podpisni element aplikacije, tudi na vstopni strani.
          Majhen top padding namenoma — naj deluje kot neposredno nadaljevanje herojske fotografije. */}
      <section style={{...sec,padding:isMobile?"56px 16px 56px":"72px 32px 80px"}}>
        <div style={{maxWidth:620,margin:"0 auto"}}>
          <DocumentTransition
            quoteSource="Uradni vir"
            quote="„Upravičeni stroški so stroški nakupa opredmetenih in neopredmetenih osnovnih sredstev, ki so neposredno povezani z izvajanjem operacije …"
            explanationLabel="AI razlaga"
            explanation="Kupite lahko novo opremo ali programsko opremo za digitalizacijo. Sistem pokrije stroške do 75.000 €. Pogoj: oprema mora biti nova."
          />
        </div>
        <div style={{textAlign:"center",marginTop:28}}><a onClick={()=>go("kako")} style={{fontSize:14,fontWeight:600,color:c.olive,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6}}>Več o delovanju platforme <ArrowRight size={16}/></a></div>
      </section>

      {/* Pricing teaser */}
      <section style={{background:c.white,padding:"80px 0"}}>
        <div style={sec}>
          <h2 style={{fontSize:34,fontWeight:600,textAlign:"center",color:c.t1,marginBottom:12,fontFamily:fSerif}}>Od 0 € naprej</h2>
          <p style={{textAlign:"center",fontSize:15,color:c.t2,marginBottom:32}}>Brezplačno za pregled razpisov. Plačljivo, ko želite ujemanje in AI pomočnika.</p>
          <div style={{display:"flex",flexDirection:isMobile?"column":"row",justifyContent:"center",gap:24}}>
            {[["Brezplačno","0 €","Pregled razpisov"],["Osnovno","19 €/mes","AI ujemanje"],["Profesionalno","49 €/mes","Ujemanje in AI pomočnik"],["Svetovalci","99 €/mes","Več podjetij"]].map(([n,p,d])=>(
              <div key={n} style={{padding:"20px 24px",borderRadius:14,border:`1px solid ${c.border}`,background:c.ivory,minWidth:150,textAlign:"center"}}><div style={{fontSize:11,fontWeight:700,color:c.t3,letterSpacing:".04em",marginBottom:8}}>{n}</div><div style={{fontSize:24,fontWeight:800,color:c.t1,marginBottom:4,whiteSpace:"nowrap"}}>{p}</div><div style={{fontSize:12,color:c.t2}}>{d}</div></div>
            ))}
          </div>
          <div style={{textAlign:"center",marginTop:28}}><a onClick={()=>go("cenik")} style={{fontSize:14,fontWeight:600,color:c.olive,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6}}>Poglej celoten cenik <ArrowRight size={16}/></a></div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section style={{...sec,padding:isMobile?"56px 16px":"80px 32px",textAlign:"center"}}>
        <h2 style={{fontSize:30,fontWeight:600,color:c.t1,marginBottom:12,fontFamily:fSerif}}>Pripravljeni?</h2>
        <p style={{fontSize:16,color:c.t2,marginBottom:32}}>Vpišite matično številko in v 2 minutah vidite, kaj je na voljo.</p>
        <button onClick={onStart} style={{display:"inline-flex",alignItems:"center",gap:10,padding:"16px 36px",borderRadius:14,border:"none",background:c.graphite,color:c.white,fontSize:16,fontWeight:700,cursor:"pointer",fontFamily:f}}>Začni brezplačno <ArrowRight size={20}/></button>
      </section>
      <Footer/>
    </div>
  );
}

/* ═══════════════════════════════════════════════════ */
/*  KAKO DELUJE (How it works subpage)                */
/* ═══════════════════════════════════════════════════ */
function HowItWorks({go,onStart}){
  const isMobile=useIsMobile();
  const sec={maxWidth:900,margin:"0 auto",padding:isMobile?"0 16px":"0 32px"};
  const card={background:c.white,border:`1px solid ${c.border}`,borderRadius:radius.lg,padding:isMobile?"22px 18px":"28px 26px",marginBottom:16};
  return(
    <div style={{fontFamily:f,color:c.t1,background:c.ivory}}>
      <Nav page="kako" go={go} onStart={onStart}/>

      {/* Hero */}
      <section style={{...sec,padding:isMobile?"52px 16px 40px":"72px 32px 56px",textAlign:"center"}}>
        <h1 style={{fontSize:isMobile?34:42,fontWeight:700,lineHeight:1.1,color:c.t1,marginBottom:12}}>Kako deluje</h1>
        <p style={{fontSize:17,color:c.t2,lineHeight:1.6,maxWidth:560,margin:"0 auto"}}>Od matične številke do prilagojenih priložnosti. Brez ročnega vnašanja podatkov, brez ugibanja.</p>
      </section>

      {/* 3 koraki */}
      <section style={{...sec,padding:isMobile?"0 16px 48px":"0 32px 64px"}}>
        {[
          {num:"01",title:"Vpišite eno številko",Icon:Search,color:"c-teal",
            desc:"Vpišete matično (10 mest) ali davčno (8 mest) številko. Sistem avtomatsko prepozna format in sproži pridobivanje podatkov iz treh virov.",
            detail:[
              {src:"AJPES poslovni register",what:"Firma, naslov, regija, pravna oblika",Icon:Database},
              {src:"JODP (Ministrstvo za finance)",what:"Celotna zgodovina prejetih državnih in de minimis pomoči z zneski in datumi",Icon:Shield},
              {src:"VIES (EU)",what:"Validacija davčne številke in potrditev aktivnega zavezanca",Icon:Globe},
            ]},
          {num:"02",title:"Potrdite profil",Icon:Check,color:"c-olive",
            desc:"Vse je predizpolnjeno. Preverite podatke iz registra, potrdite de minimis stanje in dodajte 3 številke za KMU klasifikacijo.",
            detail:[
              {src:"Avtomatsko iz registra",what:"Firma, naslov, regija in pravna oblika se prenesejo neposredno iz registra",Icon:FileSearch},
              {src:"KMU klasifikacija",what:"Vpišete število zaposlenih, letni prihodek in bilančno vsoto. Sistem izračuna, ali ste mikro, malo ali srednje podjetje.",Icon:BarChart3},
              {src:"Strateški interesi",what:"Izberete področja, ki so pomembna za vaše podjetje: digitalizacija, izvoz, zeleni prehod, razvoj in raziskave …",Icon:Layers},
            ]},
          {num:"03",title:"Prejmite priložnosti",Icon:TrendingUp,color:"c-green",
            desc:"Vaš profil primerjamo z vsemi odprtimi razpisi. V nekaj sekundah vidite, kateri vam ustrezajo in koliko.",
            detail:[
              {src:"Strateški interesi",what:"Vaši izbrani cilji (digitalizacija, izvoz, zeleni prehod …) se primerjajo z namenom razpisa.",Icon:Layers},
              {src:"KMU, regija in de minimis",what:"Velikost podjetja, lokacija in preostali de minimis prostor se preverijo proti pogojem razpisa.",Icon:Shield},
              {src:"AI razlaga",what:"Uradno besedilo razpisa prevedemo v razumljiv jezik, brez pravniškega žargona.",Icon:MessageSquare},
            ]},
        ].map((step,si)=>(
          <div key={step.num} style={{...card,padding:isMobile?"24px 18px":"32px 30px",marginBottom:20}}>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:18,paddingBottom:14,borderBottom:`1px solid ${c.border}`}}>
              <span style={{fontSize:13,fontWeight:700,color:c.olive,...tnum}}>{step.num}</span>
              <step.Icon size={19} color={c.olive} strokeWidth={1.75}/>
              <h2 style={{fontSize:19,fontWeight:700,color:c.t1}}>{step.title}</h2>
            </div>
            <p style={{fontSize:15,color:c.t2,lineHeight:1.6,marginBottom:18,maxWidth:640}}>{step.desc}</p>
            <div style={{display:"flex",flexDirection:"column"}}>
              {step.detail.map(d=>(
                <div key={d.src} style={{display:"flex",alignItems:"flex-start",gap:12,padding:"12px 0",borderTop:`1px solid ${c.border}30`}}>
                  <d.Icon size={16} color={c.t3} strokeWidth={1.75} style={{flexShrink:0,marginTop:2}}/>
                  <div><div style={{fontSize:13,fontWeight:600,color:c.t1,marginBottom:3}}>{d.src}</div><div style={{fontSize:13,color:c.t2,lineHeight:1.5}}>{d.what}</div></div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* De minimis section */}
      <section style={{background:c.white,padding:"64px 0"}}>
        <div style={sec}>
          <h2 style={{fontSize:28,fontWeight:700,color:c.t1,marginBottom:8}}>De minimis sledenje</h2>
          <p style={{fontSize:15,color:c.t2,lineHeight:1.6,marginBottom:32,maxWidth:640}}>Platforma avtomatsko pridobi podatke o prejetih državnih pomočeh iz JODP registra Ministrstva za finance. Na podlagi matične številke vidite celotno zgodovino in preostali prostor do zakonske meje.</p>
          <div style={{display:"flex",flexDirection:isMobile?"column":"row",gap:isMobile?20:32}}>
            {[
              {n:"300.000 €",d:"Nova meja de minimis pomoči po Uredbi EU 2023/2831, veljavna od 1. 1. 2024."},
              {n:"3 leta",d:"Referenčno obdobje. Seštejejo se pomoči v tekočem in dveh predhodnih fiskalnih letih."},
              {n:"Od 1. 1. 2026",d:"EU zahteva javno dostopen centralni register. Slovenija vzpostavlja strojno berljiv vir."},
            ].map(b=>(
              <div key={b.n} style={{flex:1,paddingTop:14,borderTop:`2px solid ${c.olive}`}}>
                <div style={{fontSize:26,fontWeight:800,color:c.t1,marginBottom:8,...tnum}}>{b.n}</div>
                <div style={{fontSize:13,color:c.t2,lineHeight:1.5}}>{b.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Matching osi */}
      <section style={{...sec,padding:isMobile?"48px 16px":"64px 32px"}}>
        <h2 style={{fontSize:28,fontWeight:700,color:c.t1,marginBottom:8}}>4 merila ujemanja</h2>
        <p style={{fontSize:15,color:c.t2,lineHeight:1.6,marginBottom:32,maxWidth:640}}>Vsak razpis primerjamo z vašim profilom po štirih merilih. Rezultat je odstotek ujemanja in seznam pogojev, ki pove, kje ustrezate in kje ne.</p>
        <div style={{borderTop:`1px solid ${c.border}`}}>
          {[
            {n:"Strateški interesi",d:"Vaši izbrani cilji (digitalizacija, izvoz, zeleni prehod, razvoj …) se primerjajo z namenom razpisa.",Icon:Layers},
            {n:"Velikost podjetja (KMU)",d:"Mikro, malo ali srednje podjetje po EU definiciji. Večina razpisov je namenjenih samo KMU.",Icon:Building2},
            {n:"Regija",d:"Vzhodna ali Zahodna Slovenija. Nekateri razpisi so omejeni na eno od regij.",Icon:MapPin},
            {n:"De minimis prostor",d:"Preostali prostor do 300.000 €. Če razpis presega vaš prostor, se to pozna pri ujemanju.",Icon:Shield},
          ].map(a=>(
            <div key={a.n} style={{display:"flex",alignItems:isMobile?"flex-start":"center",gap:14,padding:"16px 2px",borderBottom:`1px solid ${c.border}`}}>
              <a.Icon size={18} color={c.olive} strokeWidth={1.75} style={{flexShrink:0,marginTop:isMobile?2:0}}/>
              <div style={{flex:1}}><div style={{fontSize:14,fontWeight:600,color:c.t1,marginBottom:2}}>{a.n}</div><div style={{fontSize:13,color:c.t2,lineHeight:1.45}}>{a.d}</div></div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{...sec,padding:"48px 32px 80px",textAlign:"center"}}>
        <button onClick={onStart} style={{display:"inline-flex",alignItems:"center",gap:10,padding:"16px 36px",borderRadius:radius.md,border:"none",background:c.graphite,color:c.white,fontSize:16,fontWeight:700,cursor:"pointer",fontFamily:f}}>Začni brezplačno <ArrowRight size={20}/></button>
        <div style={{marginTop:12}}><a onClick={()=>go("cenik")} style={{fontSize:14,fontWeight:600,color:c.olive,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6}}>Poglej cenik <ArrowRight size={16}/></a></div>
      </section>
      <Footer/>
    </div>
  );
}

/* ═══════════════════════════════════════════════════ */
/*  CENIK (Pricing subpage)                           */
/* ═══════════════════════════════════════════════════ */
const plans=[
  {name:"Brezplačno",price:"0",period:"za vedno",desc:"Pregled razpisov brez personalizacije.",hl:false,cta:"Začni brezplačno",
   features:["Pregled vseh razpisov","Osnovni filtri","Iskanje po ključnih besedah"]},
  {name:"Osnovno",price:"19",period:"/ mesec",desc:"Za podjetnike, ki želijo vedeti, kaj je na voljo.",hl:false,cta:"Naroči se",
   features:["Vse iz Brezplačnega","1 profil podjetja","Odstotek ujemanja za vsak razpis","Opozorila za bližajoče se roke","De minimis sledenje (JODP)"]},
  {name:"Profesionalno",price:"49",period:"/ mesec",desc:"Za resen pristop k razpisom.",hl:true,cta:"Naroči se",
   features:["Vse iz Osnovnega","AI prevod v pogovorni jezik","AI pomočnik (vprašaj karkoli)","Koledar rokov","Izvoz poročil (PDF)","Prioritetna podpora"]},
  {name:"Za svetovalce",price:"99",period:"/ mesec",desc:"Upravljajte razpise za več strank hkrati.",hl:false,cta:"Naroči se",
   features:["Vse iz Profesionalnega","Do 10 profilov podjetij","Skupinski pregled","De minimis pregled za vse","API dostop","Osebna uvedba"]},
];

const compareFeatures=[
  ["cat","Podatki in profil"],
  ["Pregled razpisov","da","da","da","da"],
  ["Filtri in iskanje","osnovno","napredno","napredno","napredno"],
  ["Profil podjetja (AJPES)","—","1","1","do 10"],
  ["De minimis sledenje (JODP)","—","da","da","da"],
  ["KMU klasifikacija","—","da","da","da"],
  ["cat","AI funkcije"],
  ["Odstotek ujemanja","—","da","da","da"],
  ["AI prevod v pogovorni jezik","—","—","da","da"],
  ["AI pomočnik","—","—","da","da"],
  ["cat","Opozorila in izvoz"],
  ["Opozorila v aplikaciji","—","da","da","da"],
  ["Koledar rokov","—","—","da","da"],
  ["Izvoz poročil (PDF)","—","—","da","da"],
  ["cat","Podpora"],
  ["Dokumentacija","da","da","da","da"],
  ["E-poštna podpora","—","da","da","da"],
  ["Prioritetna podpora","—","—","da","da"],
  ["Osebna uvedba","—","—","—","da"],
  ["API dostop","—","—","—","da"],
];

function Pricing({go,onStart}){
  const isMobile=useIsMobile();
  const sec={maxWidth:1080,margin:"0 auto",padding:isMobile?"0 16px":"0 32px"};
  const [openFaq,setOpenFaq]=useState(null);
  const [recorded,setRecorded]=useState({});
  const registerInterest=async(planName)=>{
    if(recorded[planName])return;
    setRecorded(r=>({...r,[planName]:true}));
    try{await sb.from("plan_interest").insert({plan_name:planName});}
    catch(err){console.error("Beleženje interesa ni uspelo:",err);}
  };

  const faqs=[
    ["Ali je res brezplačno?","Da. Brezplačni paket omogoča pregled vseh razpisov in osnovne filtre brez omejitev. Ni časovne omejitve. Brez kreditne kartice."],
    ["Kdaj bodo plačljivi paketi na voljo?","Trenutno še niso odprti za naročilo. Gumb 'Naroči se' zabeleži vaš interes. Za zgodnji dostop nam pišite na grafeio.creative@gmail.com."],
    ["Kako deluje de minimis sledenje?","Sistem pridobi podatke iz JODP registra Ministrstva za finance na podlagi matične številke. Podatki so informativni, priporočamo potrditev z lastno evidenco."],
  ];

  return(
    <div style={{fontFamily:f,color:c.t1,background:c.ivory}}>
      <Nav page="cenik" go={go} onStart={onStart}/>

      {/* Hero */}
      <section style={{...sec,padding:isMobile?"52px 16px 12px":"72px 32px 16px",textAlign:"center"}}>
        <h1 style={{fontSize:isMobile?34:42,fontWeight:700,lineHeight:1.1,color:c.t1,marginBottom:12}}>Cenik</h1>
        <p style={{fontSize:17,color:c.t2,maxWidth:480,margin:"0 auto"}}>Brezplačno za pregled razpisov. Plačljivi paketi prihajajo kmalu.</p>
      </section>

      {/* Cards */}
      <section style={{...sec,padding:isMobile?"32px 16px 48px":"40px 32px 56px"}}>
        <div style={{display:"flex",flexDirection:isMobile?"column":"row",gap:20,alignItems:"stretch"}}>
          {plans.map(p=>(
            <div key={p.name} style={{flex:1,borderRadius:radius.lg,border:`${p.hl?"2px":"1px"} solid ${p.hl?c.olive:c.border}`,background:p.hl?c.oliveLight:c.white,padding:"32px 26px",display:"flex",flexDirection:"column",position:"relative"}}>
              {p.hl&&<div style={{position:"absolute",top:-12,left:"50%",transform:"translateX(-50%)",background:c.olive,color:c.white,fontSize:11,fontWeight:700,padding:"4px 16px",borderRadius:radius.xs}}>PRIPOROČAMO</div>}
              <div style={{fontSize:13,fontWeight:700,color:p.hl?c.olive:c.t2,marginBottom:8}}>{p.name}</div>
              <div style={{display:"flex",alignItems:"baseline",gap:4,marginBottom:4}}>
                <span style={{fontSize:42,fontWeight:800,color:c.t1,lineHeight:1,...tnum}}>{p.price}</span>
                <span style={{fontSize:15,color:c.t2}}>€ {p.period}</span>
              </div>
              <p style={{fontSize:13,color:c.t2,marginBottom:24,lineHeight:1.45}}>{p.desc}</p>
              <div style={{flex:1,display:"flex",flexDirection:"column",gap:10,marginBottom:28}}>
                {p.features.map((feat,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:8,fontSize:13}}>
                    <Check size={15} strokeWidth={2.5} color={c.olive}/>
                    <span style={{color:c.t1}}>{feat}</span>
                  </div>
                ))}
              </div>
              <button onClick={()=>p.cta==="Začni brezplačno"?onStart():registerInterest(p.name)} disabled={p.cta!=="Začni brezplačno"&&recorded[p.name]} style={{width:"100%",padding:"13px 0",borderRadius:radius.md,border:p.hl?"none":`1.5px solid ${c.border}`,background:p.hl?c.olive:c.white,color:p.hl?c.white:c.t1,fontSize:14,fontWeight:600,cursor:p.cta!=="Začni brezplačno"&&recorded[p.name]?"default":"pointer",fontFamily:f,opacity:p.cta!=="Začni brezplačno"&&recorded[p.name]?.6:1}}>{p.cta!=="Začni brezplačno"&&recorded[p.name]?"Zabeleženo ✓":p.cta}</button>
            </div>
          ))}
        </div>
        <p style={{textAlign:"center",fontSize:13,color:c.t3,marginTop:20}}>Vsi zneski brez DDV. Plačljivi paketi še niso odprti za naročilo, "Naroči se" zabeleži vaš interes.</p>
      </section>

      {/* Comparison table */}
      <section style={{background:c.white,padding:"64px 0"}}>
        <div style={sec}>
          <h2 style={{fontSize:28,fontWeight:700,color:c.t1,marginBottom:8,textAlign:"center"}}>Primerjava paketov</h2>
          <p style={{textAlign:"center",fontSize:15,color:c.t2,marginBottom:isMobile?10:36}}>Podroben pregled, kaj je vključeno v vsak paket.</p>
          {isMobile&&<div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,fontSize:12,color:c.t3,marginBottom:14}}>Podrsajte za več <ArrowRight size={13}/></div>}
          <div style={{position:"relative"}}>
          <div style={{borderRadius:radius.lg,border:`1px solid ${c.border}`,overflowX:isMobile?"auto":"hidden"}}>
            {/* Header row */}
            <div style={{display:"grid",gridTemplateColumns:isMobile?"180px repeat(4,120px)":"1fr repeat(4,140px)",minWidth:isMobile?660:"auto",background:c.ivory,borderBottom:`1px solid ${c.border}`}}>
              <div style={{padding:"16px 20px"}}/>
              {["Brezplačno","Osnovno","Profesionalno","Svetovalci"].map((n,i)=>(
                <div key={n} style={{padding:"16px 12px",textAlign:"center",fontWeight:700,fontSize:13,color:i===2?c.olive:c.t1,borderLeft:`1px solid ${c.border}`}}>{n}</div>
              ))}
            </div>
            {/* Rows */}
            {compareFeatures.map((row,ri)=>{
              if(row[0]==="cat") return(
                <div key={ri} style={{padding:"14px 20px",fontSize:11,fontWeight:700,letterSpacing:".04em",color:c.t3,background:c.ivory,borderBottom:`1px solid ${c.border}`}}>{row[1]}</div>
              );
              return(
                <div key={ri} style={{display:"grid",gridTemplateColumns:isMobile?"180px repeat(4,120px)":"1fr repeat(4,140px)",minWidth:isMobile?660:"auto",borderBottom:`1px solid ${c.border}20`}}>
                  <div style={{padding:"12px 20px",fontSize:13,color:c.t1}}>{row[0]}</div>
                  {[row[1],row[2],row[3],row[4]].map((val,ci)=>(
                    <div key={ci} style={{padding:"12px 12px",textAlign:"center",fontSize:13,borderLeft:`1px solid ${c.border}20`,color:val==="—"?c.t3:val==="da"?c.olive:c.t1,fontWeight:val==="da"?600:400}}>
                      {val==="da"?<CircleCheck size={16} color={c.olive} strokeWidth={2} style={{margin:"0 auto"}}/>:val==="—"?<Minus size={14} color={c.t3} style={{margin:"0 auto"}}/>:val}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
          {isMobile&&<div style={{position:"absolute",top:0,right:0,bottom:0,width:28,background:`linear-gradient(90deg, transparent, ${c.white})`,pointerEvents:"none",borderRadius:`0 ${radius.lg}px ${radius.lg}px 0`}}/>}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{...sec,padding:isMobile?"48px 16px 64px":"64px 32px 80px"}}>
        <h2 style={{fontSize:28,fontWeight:700,color:c.t1,marginBottom:8,textAlign:"center"}}>Pogosta vprašanja</h2>
        <p style={{textAlign:"center",fontSize:15,color:c.t2,marginBottom:36}}>Kar nas najpogosteje vprašajo.</p>
        <div style={{maxWidth:700,margin:"0 auto",display:"flex",flexDirection:"column",gap:8}}>
          {faqs.map(([q,a],i)=>{
            const open=openFaq===i;
            return(
              <div key={i} style={{borderRadius:14,border:`1px solid ${c.border}`,background:c.white,overflow:"hidden"}}>
                <div onClick={()=>setOpenFaq(open?null:i)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 20px",cursor:"pointer"}}>
                  <span style={{fontSize:14,fontWeight:600,color:c.t1}}>{q}</span>
                  <ChevronDown size={18} color={c.t3} style={{transform:open?"rotate(180deg)":"rotate(0)",transition:"transform .2s"}}/>
                </div>
                {open&&<div style={{padding:"0 20px 18px",fontSize:14,color:c.t2,lineHeight:1.6}}>{a}</div>}
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section style={{...sec,padding:"0 32px 80px",textAlign:"center"}}>
        <button onClick={onStart} style={{display:"inline-flex",alignItems:"center",gap:10,padding:"16px 36px",borderRadius:radius.md,border:"none",background:c.olive,color:c.white,fontSize:16,fontWeight:700,cursor:"pointer",fontFamily:f,boxShadow:`0 4px 24px ${c.olive}35`}}>Začni brezplačno <ArrowRight size={20}/></button>
      </section>
      <Footer/>
    </div>
  );
}

/* ═══════════════════════════════════════════════════ */
/*  ONBOARDING (compact — same as before)             */
/* ═══════════════════════════════════════════════════ */
const intOpts=[{id:"digi",label:"Digitalizacija",Icon:Cpu},{id:"green",label:"Zeleni prehod",Icon:Leaf},{id:"export",label:"Izvoz",Icon:Globe},{id:"rd",label:"R&D in inovacije",Icon:FlaskConical},{id:"employ",label:"Zaposlovanje",Icon:Users},{id:"energy",label:"Energetika",Icon:Zap},{id:"tourism",label:"Turizem",Icon:Building},{id:"edu",label:"Izobraževanje",Icon:GraduationCap}];

function Onboarding({onComplete,onBack}){
  const isMobile=useIsMobile();
  const [step,setStep]=useState(1);const [iv,setIv]=useState("");const [ajpesStatus,setAjpesStatus]=useState("pending");const [jodpStatus,setJodpStatus]=useState("pending");const [jodpResult,setJodpResult]=useState(null);const [ajpesResult,setAjpesResult]=useState(null);const [step6Stats,setStep6Stats]=useState(null);
  const [emp,setEmp]=useState("18");const [rev,setRev]=useState("1.4");const [bal,setBal]=useState("0.9");
  const [sel,setSel]=useState(new Set(["digi","export"]));const ir=useRef(null);
  useEffect(()=>{if(step===1&&ir.current)ir.current.focus();},[step]);
  useEffect(()=>{if(step!==6)return;let active=true;(async()=>{
    const today=new Date().toISOString();
    const{data}=await sb.from("grants").select("id,title,eligible_sectors,eligible_company_sizes,is_de_minimis,eligible_regions,raw_summary,requirements,source_url").in("status",["open","upcoming"]).or(`deadline_at.is.null,deadline_at.gte.${today}`).limit(200);
    if(!active||!data)return;
    const pr={interests:[...sel],kmu,dmFree,region:co?.region||null};
    const verified=data.filter(row=>/^https?:\/\//i.test(String(row.source_url||"")));
    const c60=verified.filter(row=>scoreGrant(row,pr)>=60).length;
    const c80=verified.filter(row=>scoreGrant(row,pr)>=80).length;
    if(active)setStep6Stats({total:c60,top:c80});
    // Shrani profil in sproži backend matching
    if(co?.id||ajpesResult?.company?.id){
      const cid=co?.id||ajpesResult?.company?.id;
      // compute-matches shrani profil (interesi/velikost/de minimis) nazaj v companies sam —
      // neposreden zapis iz brskalnika je bil tu prej in je padal na RLS (anon ni smel pisati).
      sb.functions.invoke("compute-matches",{body:{company_id:cid,interests:[...sel],kmu,dm_free:dmFree,region:co?.region||null}}).then(({error})=>{if(error)console.error("compute-matches ni uspel:",error);}).catch(err=>console.error("compute-matches ni uspel:",err));
    }
  })();return()=>{active=false;};},[step]);
  useEffect(()=>{if(step!==2)return;setAjpesStatus("pending");setJodpStatus("pending");setAjpesResult(null);setJodpResult(null);const started=Date.now();const minShow=900;(async()=>{const[ajpes,jodp]=await Promise.allSettled([sb.functions.invoke("fetch-ajpes",{body:{registration_number:iv}}),sb.functions.invoke("fetch-jodp",{body:{registration_number:iv}})]);if(jodp.status==="fulfilled"){setJodpResult(jodp.value.data);setJodpStatus(jodp.value.data?.ok===false?"error":"ok");}else setJodpStatus("error");let company=ajpes.status==="fulfilled"?ajpes.value.data?.company:null;if(!company){const{data}=await sb.from("companies").select("*").eq("registration_number",iv).maybeSingle();company=data;}if(company){setAjpesResult({ok:true,company});setAjpesStatus("ok");}else setAjpesStatus("error");const wait=Math.max(0,minShow-(Date.now()-started));setTimeout(()=>setStep(3),wait);})();},[step]);
  const e=parseInt(emp)||0,r=parseFloat(rev)||0;
  const kmu=e<10&&r<2?"MIKRO":e<50&&r<10?"MALO":e<250&&r<50?"SREDNJE":"VELIKO";
  const kmuOk=e<250&&r<50;const toggleI=id=>{const s=new Set(sel);s.has(id)?s.delete(id):s.add(id);setSel(s);};
  const dmRecs=jodpResult?.records||[];const dmReceived=dmRecs.reduce((s,r)=>s+(Number(r.amount)||0),0);const dmFree=Math.max(0,300000-dmReceived);
  const btn={width:"100%",height:52,borderRadius:radius.md,border:"none",background:c.graphite,color:c.white,fontSize:15,fontWeight:600,fontFamily:f,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8};
  const co=ajpesResult?.company;const mc={name:co?.company_name||"Podjetje ni najdeno v PRS cache",maticna:co?.registration_number||iv,taxNumber:co?.tax_number||"—",address:co?.address||"—",region:co?.region||co?.municipality||"—",nuts:co?.nuts||"—",legalForm:co?.legal_form||"—",founded:co?.founded_year||"—",age:co?.founded_year?new Date().getFullYear()-co.founded_year:"—",skdMain:co?.main_activity_code||"—",skdMainLabel:co?.main_activity_name||"—",skdOther:[]};

  if(step===1) return(<div style={{minHeight:"100vh",background:c.ivory,fontFamily:f,display:"flex",alignItems:"center",justifyContent:"center",padding:isMobile?"64px 16px 24px":24}}><div style={{width:"100%",maxWidth:480,textAlign:"center"}}><button onClick={onBack} style={{position:"absolute",top:20,left:20,background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:6,fontSize:13,color:c.t2,fontFamily:f}}><ChevronLeft size={18}/>Nazaj</button><div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:32}}><div style={{width:44,height:44,borderRadius:12,background:c.olive,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:16,color:c.white}}>AI</div><span style={{fontSize:20,fontWeight:700,color:c.t1}}>RAZPISI</span></div><h1 style={{fontSize:isMobile?25:28,fontWeight:700,lineHeight:1.15,color:c.t1,marginBottom:8}}>Vpišite matično ali davčno<br/>številko podjetja</h1><p style={{fontSize:15,color:c.t2,marginBottom:32}}>Sistem avtomatsko pridobi podatke iz AJPES registra, de minimis evidenco in preveri davčni status.</p><div style={{display:"flex",flexDirection:isMobile?"column":"row",gap:10}}><input ref={ir} value={iv} onChange={e=>setIv(e.target.value.replace(/\D/g,""))} placeholder="npr. 1234567000" style={{flex:1,height:56,border:`2px solid ${iv.length>=8?c.olive:c.border}`,borderRadius:14,padding:"0 20px",fontSize:17,fontFamily:"monospace",color:c.t1,background:c.white,outline:"none",letterSpacing:".04em",minWidth:0}} onKeyDown={e=>{if(e.key==="Enter"&&iv.length>=8)setStep(2);}}/><button onClick={()=>{if(iv.length>=8)setStep(2);}} style={{...btn,width:isMobile?"100%":"auto",padding:"0 28px",height:56,background:iv.length>=8?c.graphite:`${c.graphite}30`}}>Naprej <ArrowRight size={18}/></button></div>{iv.length===8&&<p style={{fontSize:12,color:c.olive,textAlign:"left",marginTop:8,marginBottom:0}}>Davčna številka (8 mest) — sistem jo samodejno pretvori v matično.</p>}{iv.length===10&&<p style={{fontSize:12,color:c.olive,textAlign:"left",marginTop:8,marginBottom:0}}>Matična številka (10 mest) — format je pravilen.</p>}{iv.length>0&&iv.length!==8&&iv.length!==10&&<p style={{fontSize:12,color:c.amber,textAlign:"left",marginTop:8,marginBottom:0}}>Davčna ima 8 mest · matična ima 10 mest ({iv.length}/8 ali 10).</p>}</div></div>);

  if(step===2){const items=[{label:"AJPES poslovni register",sub:"Firma, naslov, pravna oblika",status:ajpesStatus},{label:"JODP de minimis evidenca",sub:"Prejete pomoči, zneski",status:jodpStatus}];return(<div style={{minHeight:"100vh",background:c.ivory,fontFamily:f,display:"flex",alignItems:"center",justifyContent:"center",padding:isMobile?"24px 16px":24}}><div style={{width:"100%",maxWidth:440,textAlign:"center"}}><Loader2 size={32} color={c.olive} strokeWidth={2} style={{animation:"spin 1.2s linear infinite",marginBottom:24}}/><h2 style={{fontSize:22,fontWeight:700,color:c.t1,marginBottom:32}}>Pridobivam podatke …</h2><div style={{textAlign:"left",display:"flex",flexDirection:"column",gap:14}}>{items.map((it,i)=>{const done=it.status!=="pending";const ok=it.status==="ok";return(<div key={i} style={{display:"flex",alignItems:"center",gap:12,opacity:done?1:0.4,transition:"opacity .4s",padding:"12px 16px",borderRadius:12,background:done?(ok?c.oliveLight:c.amberLight):"transparent"}}><div style={{width:28,height:28,borderRadius:"50%",background:done?(ok?c.olive:c.amber):`${c.t3}30`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{done?(ok?<Check size={14} color={c.white} strokeWidth={2.5}/>:<X size={14} color={c.white} strokeWidth={2.5}/>):<span style={{width:8,height:8,borderRadius:"50%",background:c.t3,opacity:.5}}/>}</div><div style={{flex:1,minWidth:0}}><div style={{fontSize:14,fontWeight:600,color:c.t1}}>{it.label}</div><div style={{fontSize:12,color:c.t2}}>{it.sub}</div></div>{done&&<span style={{fontSize:11,fontWeight:600,color:ok?c.olive:c.amber,background:ok?c.oliveMed:c.amberLight,padding:"2px 10px",borderRadius:5}}>{ok?"OK":"NI USPELO"}</span>}</div>);})}</div><button onClick={()=>setStep(1)} style={{marginTop:32,background:"none",border:"none",cursor:"pointer",fontSize:13,color:c.t3,fontFamily:f,display:"inline-flex",alignItems:"center",gap:6}}><ChevronLeft size={15}/>Prekliči in nazaj</button></div><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>);}

  return(<div style={{background:c.ivory,minHeight:"100vh",fontFamily:f}}><div style={{borderBottom:`1px solid ${c.border}`,background:c.white,padding:"16px 24px",display:"flex",alignItems:"center",gap:12,position:"sticky",top:0,zIndex:10}}><button onClick={()=>setStep(s=>s===3?1:Math.max(s-1,1))} style={{background:"none",border:"none",cursor:"pointer",padding:4}}><ChevronLeft size={20} color={c.t2}/></button><div style={{flex:1}}><div style={{fontSize:13,color:c.t2}}>Korak {step-2} od 4</div><div style={{fontSize:15,fontWeight:600,color:c.t1}}>{step===3?"Profil podjetja":step===4?"KMU klasifikacija":step===5?"Strateški interesi":"Rezultati"}</div></div><div style={{display:"flex",gap:6}}>{[3,4,5,6].map(s=><div key={s} style={{width:s===step?24:8,height:8,borderRadius:4,background:s<=step?c.olive:`${c.t3}30`}}/>)}</div></div><div style={{maxWidth:540,margin:"0 auto",padding:"28px 24px 60px"}}>
    {step===3&&!co&&jodpResult!=null&&!jodpResult.company_in_jodp&&<div style={{textAlign:"center",padding:"48px 24px"}}><div style={{width:56,height:56,borderRadius:16,background:c.amberLight,display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:16}}><X size={24} color={c.amber}/></div><h2 style={{fontSize:20,fontWeight:700,color:c.t1,marginBottom:8}}>{jodpResult.is_davcna?"Davčne številke nismo prepoznali":"Podjetja nismo našli"}</h2>{jodpResult.is_davcna&&jodpResult.vies_company?<><p style={{fontSize:14,color:c.t2,marginBottom:12}}>Davčna <strong>{iv}</strong> je veljavna — VIES evidenca jo pozna kot:</p><div style={{background:c.white,border:`1px solid ${c.border}`,borderRadius:12,padding:"14px 18px",marginBottom:16,textAlign:"left"}}><div style={{fontSize:14,fontWeight:700,color:c.t1,marginBottom:4}}>{jodpResult.vies_company.name}</div><div style={{fontSize:12,color:c.t2}}>{jodpResult.vies_company.address}</div></div><p style={{fontSize:13,color:c.t3,marginBottom:28}}>To podjetje ni v naši lokalni bazi. Za nadaljevanje poiščite matično številko (10 mest) na <a href="https://www.ajpes.si" target="_blank" rel="noopener noreferrer" style={{color:c.olive,fontWeight:600}}>ajpes.si</a> in jo vnesite namesto davčne.</p></>:<><p style={{fontSize:14,color:c.t2,marginBottom:8}}>{jodpResult.is_davcna?<>Davčna <strong>{iv}</strong> ni bila najdena. Vnesite 10-mestno matično številko.</>:<>Številka <strong>{iv}</strong> ne obstaja v JODP evidenci.</>}</p><p style={{fontSize:13,color:c.t3,marginBottom:28}}>{jodpResult.is_davcna?"Matično najdete na ajpes.si ali poslovnem dokumentu.":"Preverite matično (10 mest) ali davčno (8 mest)."}</p></>}<button onClick={()=>setStep(1)} style={{display:"inline-flex",alignItems:"center",gap:8,padding:"12px 28px",borderRadius:12,border:"none",background:c.graphite,color:c.white,fontSize:14,fontWeight:600,fontFamily:f,cursor:"pointer"}}><ChevronLeft size={16}/>Vpiši drugo številko</button></div>}
    {step===3&&(co||!jodpResult||jodpResult.company_in_jodp)&&<><h2 style={{fontSize:22,fontWeight:700,color:c.t1,marginBottom:24}}>Profil podjetja</h2><div style={{background:c.white,border:`1px solid ${c.border}`,borderRadius:16,padding:"20px 22px",marginBottom:16}}>{[["Firma",mc.name],["Matična",mc.maticna],["Davčna",mc.taxNumber],["Naslov",mc.address],["Regija",mc.nuts&&mc.nuts!=="—"?`${mc.region} (${mc.nuts})`:mc.region],["Pravna oblika",mc.legalForm],["Ustanovljeno",mc.founded!=="—"?`${mc.founded} (${mc.age} let)`:"ni podatka"],["SKD (glavna)",mc.skdMain!=="—"?`${mc.skdMain} · ${mc.skdMainLabel}`:"ni podatka"]].map(([l,v])=>(<div key={l} style={{display:"flex",alignItems:"baseline",gap:8,padding:"9px 0",borderBottom:`1px solid ${c.border}20`,fontSize:13}}><span style={{color:c.t3,minWidth:100}}>{l}</span><span style={{color:c.t1,fontWeight:500,flex:1}}>{v}</span></div>))}</div><div style={{background:c.white,border:`1px solid ${c.olive}30`,borderLeft:`4px solid ${c.olive}`,borderRadius:16,padding:"20px 22px",marginBottom:24}}><div style={{fontSize:11,fontWeight:700,color:c.olive,marginBottom:14}}>DE MINIMIS STANJE</div><div style={{display:"flex",gap:12,marginBottom:16}}>{[["Prejeto",dmReceived.toLocaleString("sl-SI")+" €",c.t1],["Meja","300.000 €",c.t2],["Prosto",dmFree.toLocaleString("sl-SI")+" €",c.olive]].map(([l,v,col])=>(<div key={l} style={{flex:1,textAlign:"center",padding:"12px 8px",background:c.oliveLight,borderRadius:10}}><div style={{fontSize:11,color:c.t3,marginBottom:4}}>{l}</div><div style={{fontSize:17,fontWeight:700,color:col}}>{v}</div></div>))}</div>{dmRecs.length===0?<div style={{fontSize:12,color:c.t3,padding:"6px 0"}}>Ni evidentiranih de minimis pomoči.</div>:dmRecs.map((r,i)=>(<div key={i} style={{display:"flex",gap:8,fontSize:12,padding:"6px 0"}}><span style={{color:c.t3,minWidth:36}}>{r.date_awarded?r.date_awarded.substring(0,4):r.year}</span><span style={{color:c.t2,flex:1}}>{r.source}</span><span style={{fontWeight:600,color:c.t1}}>{Number(r.amount).toLocaleString("sl-SI")} €</span></div>))}</div><button onClick={()=>setStep(4)} style={btn}>Podatki so pravilni <ArrowRight size={18}/></button></>}
    {step===4&&<><h2 style={{fontSize:22,fontWeight:700,color:c.t1,marginBottom:24}}>KMU klasifikacija</h2>{[{l:"Zaposleni",v:emp,s:setEmp,u:""},{l:"Prihodek",v:rev,s:setRev,u:"M €"},{l:"Bilanca",v:bal,s:setBal,u:"M €"}].map(fi=>(<div key={fi.l} style={{marginBottom:14}}><label style={{fontSize:12,fontWeight:600,color:c.t2,display:"block",marginBottom:6}}>{fi.l}</label><div style={{display:"flex",gap:8}}><input value={fi.v} onChange={e=>fi.s(e.target.value)} style={{flex:1,height:48,border:`1px solid ${c.border}`,borderRadius:12,padding:"0 16px",fontSize:16,fontFamily:f,color:c.t1,background:c.white,outline:"none"}}/>{fi.u&&<span style={{fontSize:13,color:c.t3,display:"flex",alignItems:"center"}}>{fi.u}</span>}</div></div>))}{(e>0||r>0)&&<div style={{display:"flex",alignItems:"center",gap:14,padding:"16px 18px",borderRadius:14,background:kmuOk?c.oliveLight:c.amberLight,margin:"16px 0"}}><span style={{fontSize:12,fontWeight:700,color:kmuOk?c.olive:c.amber,background:kmuOk?c.oliveMed:c.amberLight,padding:"5px 14px",borderRadius:8}}>{kmu} PODJETJE</span></div>}<button onClick={()=>setStep(5)} style={{...btn,marginTop:16}}>Naprej <ArrowRight size={18}/></button></>}
    {step===5&&<><h2 style={{fontSize:22,fontWeight:700,color:c.t1,marginBottom:8}}>Strateški interesi</h2><p style={{fontSize:13,color:c.t2,marginBottom:24}}>Izberite področja, pomembna za vaše podjetje — po njih bomo prilagodili ujemanje z razpisi.</p><div style={{display:"flex",flexWrap:"wrap",gap:10,marginBottom:32}}>{intOpts.map(({id,label,Icon})=>{const s=sel.has(id);return(<button key={id} onClick={()=>toggleI(id)} style={{display:"flex",alignItems:"center",gap:8,padding:"12px 20px",borderRadius:12,fontSize:14,fontWeight:500,fontFamily:f,cursor:"pointer",background:s?c.oliveLight:c.white,border:`1.5px solid ${s?c.olive:c.border}`,color:s?c.olive:c.t2}}><Icon size={16}/>{label}</button>);})}</div><button onClick={()=>setStep(6)} style={btn}>Poišči priložnosti <ArrowRight size={18}/></button></>}
    {step===6&&<><div style={{textAlign:"center",marginBottom:28}}><div style={{width:56,height:56,borderRadius:radius.lg,background:c.olive,display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:16}}><Check size={26} color={c.white} strokeWidth={2.5}/></div><h2 style={{fontSize:24,fontWeight:700,color:c.t1}}>Profil pripravljen</h2></div><div style={{display:"flex",alignItems:"center",gap:16,padding:"20px 22px",borderRadius:radius.lg,background:c.oliveLight,border:`1px solid ${c.olive}20`,marginBottom:20}}><div style={{fontSize:36,fontWeight:800,color:c.olive,...tnum}}>{step6Stats!==null?step6Stats.total:"…"}</div><div><div style={{fontSize:16,fontWeight:600,color:c.t1}}>priložnosti z ujemanjem nad 60 %</div>{step6Stats?.top>0&&<div style={{fontSize:13,color:c.t2}}>{step6Stats.top} z ujemanjem nad 80 %</div>}</div></div><button onClick={()=>onComplete({maticna:co?.registration_number||iv,kmu,dmFree,interests:[...sel],region:co?.region||null})} style={{...btn,height:56,background:c.olive,fontSize:16,fontWeight:700}}>Odpri priložnosti <ArrowRight size={20}/></button></>}
  </div></div>);
}

/* ═══ DE MINIMIS SECTION ══════════════════════════ */
function DeMinimisSection({maticna}){
  const isMobile=useIsMobile();
  const[recs,setRecs]=useState([]);
  const[loading,setLoading]=useState(true);
  useEffect(()=>{
    if(!maticna){setLoading(false);return;}
    let active=true;
    (async()=>{
      const{data:co}=await sb.from("companies").select("id").eq("registration_number",maticna).maybeSingle();
      if(!active)return;
      if(!co?.id){setLoading(false);return;}
      const{data}=await sb.from("de_minimis_records").select("*").eq("company_id",co.id).order("granted_date",{ascending:false});
      if(!active)return;
      setRecs(data||[]);setLoading(false);
    })();
    return()=>{active=false;};
  },[maticna]);
  const total=recs.reduce((s,r)=>s+(Number(r.amount)||0),0);
  const lastDate=recs[0]?.granted_date||null;
  const fmtD=d=>{if(!d)return"—";const[y,m,dd]=d.split("-");return`${dd}.${m}.${y}`;};
  const fmtA=n=>n>0?n.toLocaleString("sl-SI",{minimumFractionDigits:2,maximumFractionDigits:2})+" €":"—";
  const limit=300000;
  const available=Math.max(0,limit-total);
  const pct=Math.min(100,Math.round((total/limit)*100));
  if(loading)return(<div style={{padding:"32px 0",textAlign:"center"}}><Loader2 size={20} color={c.t3} strokeWidth={2} style={{animation:"spin 1s linear infinite"}}/><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>);
  return(<div>
    <div style={{marginBottom:22}}>
      <div style={{display:"flex",flexWrap:"wrap",gap:isMobile?18:36,marginBottom:14}}>
        {[["Porabljeno",fmtA(total)],["Razpoložljivo",fmtA(available)],["Limit",fmtA(limit)]].map(([l,v])=>(
          <div key={l}><div style={{fontSize:10,fontWeight:700,color:c.t3,letterSpacing:".05em",marginBottom:4}}>{l.toUpperCase()}</div><div style={{fontSize:20,fontWeight:700,color:c.t1,...tnum}}>{v}</div></div>
        ))}
      </div>
      <div style={{height:4,borderRadius:2,background:`${c.t3}22`,overflow:"hidden",marginBottom:7}}><div style={{width:`${pct}%`,height:"100%",background:pct>=80?c.coral:c.olive}}/></div>
      <div style={{display:"flex",justifyContent:"space-between",gap:12,fontSize:12,color:c.t2,...tnum}}><span>{pct} % porabljeno</span><span>{recs.length} zapisov · zadnja {fmtD(lastDate)}</span></div>
    </div>
    {recs.length===0?(
      <div style={{padding:"36px 24px",textAlign:"center",color:c.t3,fontSize:13,background:c.ivory,borderRadius:radius.md,border:`1px solid ${c.border}`}}>Ni evidentiranih de minimis pomoči za to podjetje.</div>
    ):(
      isMobile?(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {recs.map((r,i)=>(
            <div key={r.id||i} style={{background:c.ivory,border:`1px solid ${c.border}`,borderRadius:radius.md,padding:"14px 16px"}}>
              <div style={{display:"flex",justifyContent:"space-between",gap:12,marginBottom:8}}>
                <span style={{fontSize:12,color:c.t3,...tnum}}>{fmtD(r.granted_date)}</span>
                <span style={{fontSize:13,fontWeight:700,color:c.t1,...tnum}}>{fmtA(Number(r.amount))}</span>
              </div>
              <div style={{fontSize:13,color:c.t1,fontWeight:600,marginBottom:4}}>{r.provider||"—"}</div>
              <div style={{fontSize:12,color:c.t2,lineHeight:1.4}}>{r.programme||"—"}</div>
            </div>
          ))}
        </div>
      ):(
      <div style={{borderRadius:radius.lg,border:`1px solid ${c.border}`,overflow:"hidden"}}>
        <div style={{display:"grid",gridTemplateColumns:"120px 1fr 1fr 140px",background:c.ivory,borderBottom:`1px solid ${c.border}`}}>
          {["DATUM","DAJALEC","PROGRAM / PRAVNA OSNOVA","ZNESEK"].map(h=>(
            <div key={h} style={{padding:"10px 14px",fontSize:10,fontWeight:700,letterSpacing:".05em",color:c.t3}}>{h}</div>
          ))}
        </div>
        {recs.map((r,i)=>(
          <div key={r.id||i} style={{display:"grid",gridTemplateColumns:"120px 1fr 1fr 140px",borderTop:`1px solid ${c.border}20`,background:i%2===0?c.white:`${c.ivory}80`}}>
            <div style={{padding:"11px 14px",fontSize:13,color:c.t2,...tnum}}>{fmtD(r.granted_date)}</div>
            <div style={{padding:"11px 14px",fontSize:13,color:c.t1,fontWeight:500}}>{r.provider||"—"}</div>
            <div style={{padding:"11px 14px",fontSize:13,color:c.t2,lineHeight:1.4}}>{r.programme||"—"}</div>
            <div style={{padding:"11px 14px",fontSize:13,fontWeight:700,color:c.t1,textAlign:"right",...tnum}}>{fmtA(Number(r.amount))}</div>
          </div>
        ))}
      </div>)
    )}
  </div>);
}

/* ═══ KOLEDAR ROKOV ════════════════════════════════ */
function DeadlineCalendar({grantItems=[],onSelect}){
  const isMobile=useIsMobile();
  const [monthOffset,setMonthOffset]=useState(0);
  const today=new Date();
  const todayKey=`${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;

  const withDeadline=grantItems.filter(g=>g.deadlineAt&&(g.status==="open"||g.status==="upcoming"));

  const viewDate=new Date(today.getFullYear(),today.getMonth()+monthOffset,1);
  const year=viewDate.getFullYear(),month=viewDate.getMonth();
  const startWeekday=(new Date(year,month,1).getDay()+6)%7; // ponedeljek = 0
  const daysInMonth=new Date(year,month+1,0).getDate();
  const monthLabel=viewDate.toLocaleDateString("sl-SI",{month:"long",year:"numeric"});

  const byDay={};
  withDeadline.forEach(g=>{
    const d=new Date(g.deadlineAt);
    const key=`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    (byDay[key]=byDay[key]||[]).push(g);
  });

  const cells=[];
  for(let i=0;i<startWeekday;i++)cells.push(null);
  for(let d=1;d<=daysInMonth;d++)cells.push(d);

  const startOfToday=new Date(today.getFullYear(),today.getMonth(),today.getDate());
  const upcoming=[...withDeadline]
    .filter(g=>new Date(g.deadlineAt)>=startOfToday)
    .sort((a,b)=>new Date(a.deadlineAt)-new Date(b.deadlineAt))
    .slice(0,8);

  const navBtn={width:32,height:32,borderRadius:8,border:`1px solid ${c.border}`,background:c.white,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"};

  return(<div style={{flex:1,overflowY:isMobile?"visible":"auto",padding:isMobile?"18px 16px 28px":"28px 28px 40px"}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
      <h2 style={{fontSize:22,fontWeight:700,color:c.t1,textTransform:"capitalize"}}>{monthLabel}</h2>
      <div style={{display:"flex",gap:8}}>
        <div onClick={()=>setMonthOffset(m=>m-1)} style={navBtn}><ChevronLeft size={16} color={c.t2}/></div>
        <div onClick={()=>setMonthOffset(0)} style={{...navBtn,width:"auto",padding:"0 14px",fontSize:12,fontWeight:600,color:c.t1,fontFamily:f}}>Danes</div>
        <div onClick={()=>setMonthOffset(m=>m+1)} style={navBtn}><ChevronRight size={16} color={c.t2}/></div>
      </div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:6,marginBottom:8}}>
      {["Pon","Tor","Sre","Čet","Pet","Sob","Ned"].map(d=><div key={d} style={{fontSize:11,fontWeight:700,color:c.t3,textAlign:"center",padding:"4px 0"}}>{d}</div>)}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:6,marginBottom:32}}>
      {cells.map((d,i)=>{
        if(d===null)return<div key={i}/>;
        const key=`${year}-${month}-${d}`;
        const items=byDay[key]||[];
        const isToday=key===todayKey;
        const maxShow=isMobile?1:2;
        return(<div key={i} onClick={()=>items.length&&onSelect(items[0])} style={{minHeight:isMobile?52:76,minWidth:0,borderRadius:10,border:`1px solid ${isToday?c.olive:c.border}`,background:items.length?c.oliveLight:c.white,padding:"6px 7px",display:"flex",flexDirection:"column",gap:3,cursor:items.length?"pointer":"default"}}>
          <span style={{fontSize:12,fontWeight:isToday?700:500,color:isToday?c.olive:c.t2}}>{d}</span>
          {items.slice(0,maxShow).map(g=><span key={g.id} style={{fontSize:9,color:c.t1,background:c.white,border:`1px solid ${c.olive}30`,borderRadius:5,padding:"1px 5px",display:"block",width:"100%",boxSizing:"border-box",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{g.title}</span>)}
          {items.length>maxShow&&<span style={{fontSize:9,color:c.olive,fontWeight:700}}>+{items.length-maxShow}</span>}
        </div>);
      })}
    </div>
    <h3 style={{fontSize:15,fontWeight:700,color:c.t1,marginBottom:10}}>Naslednji roki</h3>
    {upcoming.length===0?<div style={{padding:"20px 18px",borderRadius:radius.md,background:c.white,border:`1px solid ${c.border}`,color:c.t2,fontSize:13}}>Ni prihajajočih rokov med aktualnimi razpisi.</div>:(
    <div style={{borderTop:`1px solid ${c.border}`}}>
      {upcoming.map(g=>{const d=new Date(g.deadlineAt);const urgency=deadlineUrgency(g.deadlineAt);const urgentColor=urgency.level==="urgent"?c.coral:urgency.level==="soon"?c.amber:c.t1;return(<div key={g.id} onClick={()=>onSelect(g)} style={{display:"flex",alignItems:"center",gap:16,padding:"13px 2px",borderBottom:`1px solid ${c.border}`,cursor:"pointer"}}>
        <div style={{width:40,textAlign:"center",flexShrink:0,...tnum}}>
          <div style={{fontSize:17,fontWeight:700,color:urgentColor,lineHeight:1.1}}>{d.getDate()}</div>
          <div style={{fontSize:10,color:urgency.level==="urgent"||urgency.level==="soon"?urgentColor:c.t3,textTransform:"uppercase"}}>{d.toLocaleDateString("sl-SI",{month:"short"})}</div>
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:14,fontWeight:600,color:c.t1,marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{g.title}</div>
          <div style={{fontSize:12,color:c.t2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{g.funder}</div>
        </div>
        {!isMobile&&<div style={{fontSize:13,fontWeight:700,color:c.t1,flexShrink:0,...tnum}}>{g.amountLabel}</div>}
        <ChevronRight size={16} color={c.t3}/>
      </div>);})}
    </div>
    )}
  </div>);
}

// Isti prag (14/3 dni) kot v computeAlerts spodaj, samo za vizualni poudarek
// roka v vrstici razpisa/drawerju — ne vpliva na scoring ali opozorila.
function deadlineUrgency(deadlineAt){
  if(!deadlineAt)return{daysLeft:null,level:"none"};
  const daysLeft=Math.ceil((new Date(deadlineAt).getTime()-Date.now())/86400000);
  if(daysLeft<0)return{daysLeft,level:"none"};
  if(daysLeft<=3)return{daysLeft,level:"urgent"};
  if(daysLeft<=14)return{daysLeft,level:"soon"};
  return{daysLeft,level:"far"};
}

/* ═══ OPOZORILA ════════════════════════════════════ */
// Samo v aplikaciji, izračunano iz obstoječih podatkov (brez novega vira/e-pošte):
// bližajoči se roki (≤14 dni) in novi razpisi (zadnjih 7 dni), oboje samo za ujemanje ≥60 %.
function computeAlerts(grantItems=[]){
  const now=Date.now(),DAY=86400000;
  const relevant=grantItems.filter(g=>g.matchScore>=60);

  const deadlineSoon=relevant
    .filter(g=>g.deadlineAt)
    .map(g=>({...g,daysLeft:Math.ceil((new Date(g.deadlineAt).getTime()-now)/DAY)}))
    .filter(g=>g.daysLeft>=0&&g.daysLeft<=14)
    .sort((a,b)=>a.daysLeft-b.daysLeft);

  const newMatches=relevant
    .filter(g=>g.createdAt&&(now-new Date(g.createdAt).getTime())<=7*DAY)
    .sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));

  return{deadlineSoon,newMatches,total:deadlineSoon.length+newMatches.length};
}

// Najbližji prihodnji rok med relevantnimi (ujemanje ≥60 %) razpisi — za kompaktni Pregled.
// Izven komponente (kot computeAlerts zgoraj), da Date.now() ni klican neposredno v render telesu.
function nearestUpcomingDeadline(grantItems=[]){
  const now=Date.now();
  const relevant=grantItems.filter(g=>g.matchScore>=60&&g.deadlineAt&&new Date(g.deadlineAt).getTime()>=now);
  return relevant.length?relevant.reduce((a,b)=>new Date(a.deadlineAt)<new Date(b.deadlineAt)?a:b):null;
}

function AlertsView({grantItems=[],onSelect}){
  const isMobile=useIsMobile();
  const{deadlineSoon,newMatches,total}=computeAlerts(grantItems);

  const Row=({g,badge,badgeColor})=>(
    <div onClick={()=>onSelect(g)} style={{display:"flex",alignItems:"center",gap:14,padding:"13px 2px",borderBottom:`1px solid ${c.border}`,cursor:"pointer"}}>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:14,fontWeight:600,color:c.t1,marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{g.title}</div>
        <div style={{fontSize:12,color:c.t2}}>{g.funder}</div>
      </div>
      <span style={{fontSize:11,fontWeight:700,color:badgeColor,background:`${badgeColor}18`,padding:"4px 10px",borderRadius:radius.xs,flexShrink:0,whiteSpace:"nowrap"}}>{badge}</span>
      <ChevronRight size={16} color={c.t3}/>
    </div>
  );
  const empty=(text)=><div style={{padding:"20px 18px",borderRadius:radius.md,background:c.white,border:`1px solid ${c.border}`,color:c.t2,fontSize:13}}>{text}</div>;

  return(<div style={{flex:1,overflowY:isMobile?"visible":"auto",padding:isMobile?"18px 16px 28px":"28px 28px 40px"}}>
    <div style={{marginBottom:28}}>
      <h2 style={{fontSize:22,fontWeight:700,color:c.t1,marginBottom:4}}>Opozorila</h2>
      <p style={{fontSize:13,color:c.t2}}>{total>0?`${total} opozoril za razpise z ujemanjem nad 60 %.`:"Trenutno ni opozoril za vaš profil."}</p>
    </div>
    <h3 style={{fontSize:15,fontWeight:700,color:c.t1,marginBottom:10}}>Bližajoči se roki</h3>
    <div style={{marginBottom:28}}>
      {deadlineSoon.length===0?empty("Noben ujemajoč razpis nima roka v naslednjih 14 dneh."):
        <div style={{borderTop:`1px solid ${c.border}`}}>{deadlineSoon.map(g=><Row key={g.id} g={g} badge={g.daysLeft===0?"DANES":g.daysLeft===1?"JUTRI":`ŠE ${g.daysLeft} DNI`} badgeColor={g.daysLeft<=3?c.coral:c.amber}/>)}</div>}
    </div>
    <h3 style={{fontSize:15,fontWeight:700,color:c.t1,marginBottom:10}}>Novi ujemajoči razpisi</h3>
    {newMatches.length===0?empty("Zadnjih 7 dni ni novih ujemajočih razpisov."):
      <div style={{borderTop:`1px solid ${c.border}`}}>{newMatches.map(g=><Row key={g.id} g={g} badge="NOVO" badgeColor={c.olive}/>)}</div>}
  </div>);
}

/* ═══ AI POMOČNIK ══════════════════════════════════ */
// Samo pogovor (Q&A) o razpisih/profilu — brez tool use, ne spreminja ničesar v bazi.
function AiAssistantChat({companyId}){
  const isMobile=useIsMobile();
  const [messages,setMessages]=useState([]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const [errorMsg,setErrorMsg]=useState(null);
  const bottomRef=useRef(null);

  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[messages,loading]);

  const suggestions=["Kateri razpis mi najbolj ustreza?","Kaj pomeni de minimis?","Kdaj je najbližji rok?","Kako deluje vavčer?"];

  const send=async(textArg)=>{
    const trimmed=(textArg??input).trim();
    if(!trimmed||loading)return;
    const history=messages;
    setMessages(m=>[...m,{role:"user",content:trimmed}]);
    setInput("");
    setLoading(true);
    setErrorMsg(null);
    try{
      const{data,error}=await sb.functions.invoke("ai-assistant",{body:{company_id:companyId,message:trimmed,history}});
      if(error||data?.error){
        setErrorMsg(data?.error||"AI pomočnik trenutno ni dosegljiv. Poskusite znova.");
      } else {
        setMessages(m=>[...m,{role:"assistant",content:data.reply}]);
      }
    } catch{
      setErrorMsg("AI pomočnik trenutno ni dosegljiv. Poskusite znova.");
    } finally {
      setLoading(false);
    }
  };

  return(<div style={{flex:1,overflowY:isMobile?"visible":"hidden",display:"flex",flexDirection:"column",padding:isMobile?"18px 16px":"28px 28px"}}>
    <div style={{marginBottom:16,flexShrink:0}}>
      <h2 style={{fontSize:22,fontWeight:700,color:c.t1,marginBottom:4}}>AI pomočnik</h2>
      <p style={{fontSize:13,color:c.t2}}>Vprašajte o razpisih ali svojem profilu. Pomočnik svetuje, ne more pa ničesar spremeniti v vašem profilu.</p>
    </div>
    <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:14,marginBottom:16,paddingRight:4,minHeight:isMobile?260:0}}>
      {messages.length===0&&<div style={{display:"flex",flexDirection:"column",gap:10}}>
        <div style={{padding:"16px 18px",borderRadius:14,background:c.cream,fontSize:14,color:c.t1,lineHeight:1.5,alignSelf:"flex-start",maxWidth:520}}>Pozdravljeni. Lahko vam pomagam razumeti razpise ali predlagam, kateri najbolj ustreza vašemu podjetju. Kaj vas zanima?</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
          {suggestions.map(s=><button key={s} onClick={()=>send(s)} style={{padding:"8px 14px",borderRadius:10,border:`1px solid ${c.border}`,background:c.white,fontSize:12,color:c.t2,cursor:"pointer",fontFamily:f}}>{s}</button>)}
        </div>
      </div>}
      {messages.map((m,i)=>(
        <div key={i} style={{alignSelf:m.role==="user"?"flex-end":"flex-start",maxWidth:isMobile?"90%":560}}>
          <div style={{padding:"12px 16px",borderRadius:14,fontSize:14,lineHeight:1.55,whiteSpace:"pre-line",background:m.role==="user"?c.graphite:c.cream,color:m.role==="user"?c.white:c.t1}}>{m.content}</div>
        </div>
      ))}
      {loading&&<div style={{alignSelf:"flex-start",padding:"12px 16px",borderRadius:14,background:c.cream,fontSize:13,color:c.t2}}>Razmišljam …</div>}
      {errorMsg&&<div style={{alignSelf:"flex-start",padding:"12px 16px",borderRadius:14,background:c.amberLight,color:c.amber,fontSize:13,maxWidth:520}}>{errorMsg}</div>}
      <div ref={bottomRef}/>
    </div>
    <div style={{display:"flex",gap:8,flexShrink:0}}>
      <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();send();}}} placeholder="Vprašajte o razpisih …" style={{flex:1,height:48,border:`1px solid ${c.border}`,borderRadius:radius.md,padding:"0 16px",fontSize:14,fontFamily:f,color:c.t1,background:c.white,outline:"none"}}/>
      <button onClick={()=>send()} disabled={loading||!input.trim()} style={{padding:"0 22px",height:48,borderRadius:radius.md,border:"none",background:loading||!input.trim()?c.border:c.graphite,color:c.white,fontSize:14,fontWeight:600,fontFamily:f,cursor:loading||!input.trim()?"default":"pointer"}}>Pošlji</button>
    </div>
  </div>);
}

/* ═══ COMPANY PROFILE ══════════════════════════════ */
function CompanyProfile({maticna,grantItems=[],onGoToGrants}){
  const isMobile=useIsMobile();
  const[company,setCompany]=useState(null);const[loading,setLoading]=useState(true);
  useEffect(()=>{if(!maticna){setLoading(false);return;}let active=true;(async()=>{const{data}=await sb.from("companies").select("*").eq("registration_number",maticna).maybeSingle();if(active){setCompany(data||null);setLoading(false);}})();return()=>{active=false;};},[maticna]);
  const mc={name:company?.company_name||"Podjetje ni najdeno",maticna:company?.registration_number||maticna||"—",taxNumber:company?.tax_number||"—",address:company?.address||"—",region:company?.region||company?.municipality||"—",nuts:company?.nuts||"—",legalForm:company?.legal_form||"—",founded:company?.founded_year||"—",skdMain:company?.main_activity_code||"—",skdMainLabel:company?.main_activity_name||"—"};
  // Naslov sekcije: ikona neposredno ob besedilu, brez beige kvadratka.
  const sh=(Icon,title)=>(<div style={{display:"flex",alignItems:"center",gap:9,marginBottom:16,paddingBottom:12,borderBottom:`1px solid ${c.border}`}}><Icon size={17} color={c.olive} strokeWidth={1.75}/><h2 style={{fontSize:14,fontWeight:700,letterSpacing:".02em",color:c.t1,margin:0,textTransform:"uppercase"}}>{title}</h2></div>);
  const card={background:c.white,border:`1px solid ${c.border}`,borderRadius:radius.lg,padding:isMobile?"18px 16px":"22px 24px",marginBottom:20};
  if(loading)return(<div style={{padding:isMobile?"24px 16px":"48px",fontFamily:f,color:c.t2}}>Nalagam podatke podjetja …</div>);
  return(<div style={{padding:isMobile?"20px 16px 40px":"28px 28px 60px"}}>
    <div style={{marginBottom:24}}>
      <h1 style={{fontSize:isMobile?20:22,fontWeight:700,color:c.t1,marginBottom:4}}>{mc.name}</h1>
      <div style={{fontSize:13,color:c.t2,...tnum}}>Matična {mc.maticna} · {mc.region} · {mc.legalForm}</div>
    </div>
    <div style={card}>
      {sh(Building2,"Osnovni podatki")}
      <DataList rows={[["Matična",mc.maticna],["Davčna",mc.taxNumber],["Naslov",mc.address],["Regija",mc.nuts&&mc.nuts!=="—"?`${mc.region} (${mc.nuts})`:mc.region],["Pravna oblika",mc.legalForm],["Ustanovljeno",mc.founded!=="—"?String(mc.founded):"ni podatka"],["SKD",mc.skdMain!=="—"?`${mc.skdMain} · ${mc.skdMainLabel}`:"ni podatka"]]}/>
    </div>
    <div style={card}>
      {sh(Shield,"De minimis pomoči")}
      <DeMinimisSection maticna={maticna}/>
    </div>
    <div style={card}>
      {sh(TrendingUp,"Priporočeni razpisi")}
      {(()=>{const matched=grantItems.filter(g=>g.matchScore>=60);return(<>
        <div style={{fontSize:13,color:c.t2,marginBottom:matched.length?4:0}}>{matched.length>0?`${matched.length} razpisov z ujemanjem nad 60 %.`:"Ni razpisov z ujemanjem nad 60 %."}</div>
        {matched.slice(0,3).map(g=><div key={g.id} style={{display:"grid",gridTemplateColumns:"48px minmax(0,1fr)",alignItems:"center",gap:14,padding:"10px 0",borderBottom:`1px solid ${c.border}20`}}><Score value={g.matchScore}/><div style={{minWidth:0}}><div style={{display:"flex",alignItems:"center",gap:7,fontSize:13,fontWeight:600,color:c.t1,lineHeight:1.3}}><GrantIcon type={g.icon}/><span style={{whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{g.title}</span></div><div style={{fontSize:11,color:c.t2,...tnum}}>{g.amountLabel}</div></div></div>)}
        {onGoToGrants&&<button onClick={onGoToGrants} style={{marginTop:14,display:"flex",alignItems:"center",gap:8,padding:"10px 18px",borderRadius:radius.md,border:"none",background:c.graphite,color:c.white,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:f}}>Prikaži vse razpise <ChevronRight size={14}/></button>}
      </>);})()}
    </div>
  </div>);
}

const fallbackGrants=[
  {id:"fallback-1",title:"Digitalizacija poslovanja za MSP",funder:"Primer razpisa",status:"open",deadline:"brez roka",deadlineAt:null,amountLabel:"do 75.000 €",fundingType:"nepovratna sredstva",tags:["Digitalizacija","MSP"],icon:"digital",matchScore:72,topMatch:true,cofinancing:"do 60 %",region:"Slovenija",aiSummary:"Primer razpisa za prikaz v primeru, ko baza še ne vrne aktualnih razpisov.",officialText:null,hasAiSummary:false,sourceUrl:null,sourceName:"ni podatka",lastChecked:"ni preverjeno",qualityStatus:"needs_review",qualityLabel:"PREGLED",checklist:[{label:"Regija ustreza",p:true},{label:"KMU pogoj",p:true},{label:"De minimis prostor",p:true}]},
];

function formatGrantDate(value){
  if(!value)return"brez roka";
  const d=new Date(value);
  if(Number.isNaN(d.getTime()))return"brez roka";
  return d.toLocaleDateString("sl-SI",{day:"2-digit",month:"2-digit",year:"numeric"});
}

function formatGrantAmount(value){
  const n=Number(value);
  if(!Number.isFinite(n)||n<=0)return"ni navedeno";
  if(n>=1000000)return`${(n/1000000).toLocaleString("sl-SI",{maximumFractionDigits:1})} mio €`;
  return`${Math.round(n).toLocaleString("sl-SI")} €`;
}

function formatLastChecked(value){
  if(!value)return"ni preverjeno";
  const d=new Date(value);
  if(Number.isNaN(d.getTime()))return"ni preverjeno";
  return d.toLocaleDateString("sl-SI",{day:"2-digit",month:"2-digit",year:"numeric"});
}

function formatDateTime(value){
  if(!value)return"ni podatka";
  const d=new Date(value);
  if(Number.isNaN(d.getTime()))return"ni podatka";
  return d.toLocaleString("sl-SI",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"});
}

function sourceHost(value){
  try{return new URL(value).hostname.replace(/^www\./,"");}
  catch{return"vir ni naveden";}
}

function effectiveGrantStatus(row){
  if(row.deadline_at&&new Date(row.deadline_at).getTime()<Date.now())return"closed";
  return row.status||"open";
}

function scoreGrant(row,profile){
  const tags=row.eligible_sectors||[];
  const sizes=row.eligible_company_sizes||[];
  // Razširi iskalno besedilo na summary in zahteve: tam je največ eligibility info
  const hay=[...tags,row.title||"",row.raw_summary||"",row.requirements||"",row.plain_language_summary||""].join(" ").toLowerCase();
  let s=50;
  if(profile){
    const kws={
      digi:["digitalizacij","digital","informatiz","e-poslovan","it rešit"],
      green:["zeleni","okolj","trajnost","podnebj","ekolo","obnovljiv","co2","emisij","energetsk"],
      export:["izvoz","internacionalizacij","tuj trg","mednarod","eures"],
      rd:["inovacij","razvoj","raziskov","r&d","tehnolog","patent","startup","zagonsk"],
      employ:["zaposlov","delovno mest","kadr","brezposel","usposab na del"],
      energy:["energetik","energij","obnovljiv vir","toplotn","sončn","fotovoltai","biomasa"],
      tourism:["turizem","turistič","prenočitev","gostinst"],
      edu:["izobra","usposab","kompetenc","znanj","šolanj","štipendij"],
      agri:["kmetij","ribiš","gozdarst","živinorej","sadjarst","vinogradn"],
      culture:["kultur","umetnost","avdiovizual","film","glasb"],
    };
    for(const[id,ks]of Object.entries(kws)){
      if(profile.interests?.includes(id)&&ks.some(k=>hay.includes(k)))s+=15;
    }
    // Ujemanje velikosti podjetja
    const sizeMap={MIKRO:"micro",MALO:"small",MSP:"small",SREDNJE:"medium",VELIKO:"large"};
    const compSize=sizeMap[profile.kmu]||null;
    if(sizes.length>0&&compSize){
      if(sizes.includes(compSize)||(compSize==="micro"&&sizes.includes("small")))s+=10;
      else if(!sizes.includes("large"))s-=20;
    } else if(tags.some(t=>t==="MSP")&&profile.kmu==="VELIKO"){
      s-=40;
    }
    // De minimis
    if(row.is_de_minimis)s+=profile.dmFree>0?5:-20;
    // Regija
    const er=row.eligible_regions||[];
    if(er.length>0&&profile.region){
      const m=er.some(r=>r.toLowerCase().includes((profile.region||"").toLowerCase())||(profile.region||"").toLowerCase().includes(r.toLowerCase()));
      if(!m)s-=25;
    }
  }else{
    s+=Math.min(30,tags.length*6)+(row.is_de_minimis?5:0);
  }
  return Math.min(95,Math.max(10,s));
}

function mapGrant(row,profile){
  const tags=[...(row.eligible_sectors||[]),...(row.is_de_minimis?["de minimis"]:[])].slice(0,5);
  const title=String(row.title||"Neimenovan razpis");
  const summary=row.plain_language_summary||row.raw_summary||row.requirements||"Podrobnosti so na voljo v uradni dokumentaciji razpisa.";
  const score=scoreGrant(row,profile);
  const status=effectiveGrantStatus(row);
  const qualityStatus=row.raw_payload?.quality_status||(row.source_url&&row.deadline_at?"verified":"needs_review");
  const fundingType=row.raw_payload?.funding_type||(
    row.is_de_minimis?"de minimis":"nepovratna sredstva"
  );
  return{
    id:row.id,
    title,
    funder:row.provider||"Ni navedeno",
    status,
    deadline:formatGrantDate(row.deadline_at),
    deadlineAt:row.deadline_at,
    createdAt:row.created_at,
    amountLabel:formatGrantAmount(row.max_aid_amount),
    fundingType,
    tags:tags.length?tags:["Razpis"],
    icon:tags.join(" ").toLowerCase().includes("digital")?"digital":tags.join(" ").toLowerCase().includes("zeleni")?"green":"grant",
    matchScore:Math.min(95,score),
    topMatch:false,
    cofinancing:row.funding_rate?`${row.funding_rate}%`:"ni navedeno",
    region:(row.eligible_regions||[]).join(", ")||"Slovenija",
    aiSummary:summary,
    // Za prikaz "uradni vir → AI razlaga": samo kadar imamo resnično oboje ločeno,
    // sicer se prikaže samo en (obstoječi) povzetek — brez izmišljanja uradnega citata.
    officialText:row.raw_summary||row.requirements||null,
    hasAiSummary:!!row.plain_language_summary,
    sourceUrl:row.source_url,
    sourceName:sourceHost(row.source_url),
    lastChecked:formatLastChecked(row.last_checked_at),
    qualityStatus,
    qualityLabel:qualityStatus==="verified"?"PREVERJENO":"PREGLED",
    checklist:[
      {label:"Razpis ni potekel",p:status==="open"||status==="upcoming"},
      {label:"Vir je naveden",p:!!row.source_url},
      {label:"Zadnje preverjanje shranjeno",p:!!row.last_checked_at},
      {label:"Regija ni izključujoča",p:!(row.eligible_regions||[]).length},
    ],
  };
}

const grantFilters=["Vse","Najbolj ustrezne","Odprto","Nepovratna","Vavčerji","Krediti","Garancije","Digitalizacija","Trajnost"];

function filterGrants(grants,filter){
  const lower=filter.toLowerCase();
  const list=grants.filter(g=>{
    const hay=[g.title,g.funder,g.fundingType,g.sourceName,...(g.tags||[])].join(" ").toLowerCase();
    if(filter==="Vse"||filter==="Najbolj ustrezne")return true;
    if(filter==="Odprto")return g.status==="open";
    if(filter==="Nepovratna")return g.fundingType==="nepovratna sredstva";
    if(filter==="Vavčerji")return g.fundingType==="vavčer";
    if(filter==="Krediti")return g.fundingType==="kredit";
    if(filter==="Garancije")return g.fundingType==="garancija";
    if(filter==="Trajnost")return hay.includes("zeleni")||hay.includes("okolj")||hay.includes("lca")||hay.includes("trajnost");
    return hay.includes(lower);
  });
  return [...list].sort((a,b)=>{
    if(filter==="Najbolj ustrezne")return b.matchScore-a.matchScore;
    const ad=a.deadlineAt?new Date(a.deadlineAt).getTime():Number.MAX_SAFE_INTEGER;
    const bd=b.deadlineAt?new Date(b.deadlineAt).getTime():Number.MAX_SAFE_INTEGER;
    return ad-bd;
  });
}

// Majhna, tehnična ikona neposredno ob naslovu — brez velikega beige kvadratka.
function GrantIcon({type,size=17}){
  const Icon=type==="digital"?Cpu:type==="green"?Leaf:FileText;
  return(<Icon size={size} color={c.t3} strokeWidth={1.75} style={{flexShrink:0}}/>);
}

// Pill je tu upravičen: majhna semantična oznaka (status/tip/filter), ne privzeta oblika.
function Tag({label,variant}){
  const bg=variant==="status"?c.oliveLight:variant==="deadline"?c.amberLight:variant==="quality"?c.signalLight:c.ivory;
  const col=variant==="status"?c.olive:variant==="deadline"?c.amber:variant==="quality"?c.signal:c.t2;
  return(<span style={{fontSize:10,fontWeight:700,color:col,background:bg,border:`1px solid ${c.border}80`,padding:"3px 7px",borderRadius:radius.xs,whiteSpace:"nowrap"}}>{label}</span>);
}

// Sekundarna metapodatkovna vrstica razpisa (kategorije, vir, rok, preverjeno) —
// navaden tekst namesto dodatnih badgeov, posamezen del je lahko poudarjen (npr. bližajoč se rok).
function MetaLine({parts}){
  const items=parts.filter(p=>p!==null&&p!==undefined&&p!=="");
  return(<div style={{fontSize:12,color:c.t2,marginBottom:7,lineHeight:1.4}}>
    {items.map((p,i)=>{
      const seg=typeof p==="string"?{text:p}:p;
      return(<span key={i} style={{color:seg.color||c.t2,fontWeight:seg.weight||400,...tnum}}>{seg.text}{i<items.length-1?" · ":""}</span>);
    })}
  </div>);
}

/* ═══════════════════════════════════════════════════ */
/*  DASHBOARD                                         */
/* ═══════════════════════════════════════════════════ */
function SourceHealthPanel({items,isMobile}){
  if(!items.length)return null;
  const label=source=>source==="evropskasredstva"?"Evropska sredstva":source==="jodp"?"JODP":source==="sps"?"SPS":source;
  return(<div style={{marginBottom:28}}>
    <div style={{fontSize:11,fontWeight:700,letterSpacing:".05em",color:c.t3,marginBottom:10}}>SISTEMSKI VIRI</div>
    <div style={{borderTop:`1px solid ${c.border}`}}>
      {items.map(item=>{const ok=(Number(item.failure_count)||0)===0&&!item.last_error;return(
        <div key={item.source} style={{display:"flex",flexDirection:isMobile?"column":"row",alignItems:isMobile?"flex-start":"center",gap:isMobile?4:16,padding:"10px 2px",borderBottom:`1px solid ${c.border}`}}>
          <div style={{fontSize:13,fontWeight:600,color:c.t1,minWidth:160,flexShrink:0}}>{label(item.source)}</div>
          <Status ok={ok} label={ok?"deluje":"napaka"}/>
          <div style={{fontSize:12,color:c.t2,...tnum,flex:1,minWidth:0}}>{formatDateTime(item.last_success)}</div>
          {item.last_error&&<div style={{fontSize:12,color:c.coral,wordBreak:"break-word"}}>{item.last_error}</div>}
        </div>
      );})}
    </div>
  </div>);
}

function Dashboard({maticna,profile}){
  const isMobile=useIsMobile();
  const isCompact=useIsCompact();
  const [grantItems,setGrantItems]=useState(fallbackGrants);const [sel,setSel]=useState(fallbackGrants[0]);const [af,setAf]=useState("Vse");const [showD,setShowD]=useState(true);const [navSel,setNavSel]=useState("Pregled");const[company,setCompany]=useState(null);const[sourceHealth,setSourceHealth]=useState([]);
  useEffect(()=>{let active=true;(async()=>{
    const today=new Date().toISOString();
    // Najprej poskusi z vnaprej izračunanimi matchi iz compute-matches (backend engine)
    if(company?.id){
      const{data:matches,error:matchErr}=await sb.from("grant_matches").select("match_score,grants(*)").eq("company_id",company.id).order("match_score",{ascending:false}).limit(80);
      if(matchErr)console.error("grant_matches branje ni uspelo, uporabljam lokalni izračun:",matchErr);
      if(!active)return;
      const fromMatches=(matches||[])
        .filter(m=>m.grants&&/^https?:\/\//i.test(String(m.grants.source_url||""))&&["open","upcoming"].includes(effectiveGrantStatus(m.grants)))
        .map(m=>({...mapGrant(m.grants,profile),matchScore:Math.min(95,Math.max(10,Math.round(m.match_score)))}));
      if(fromMatches.length){
        fromMatches.sort((a,b)=>b.matchScore-a.matchScore);
        setGrantItems(fromMatches);setSel(fromMatches[0]);
        return;
      }
    }
    // Fallback: grant_matches še ni na voljo (nov profil, edge function ni uspela, ali brez company_id), izračunaj lokalno
    const{data}=await sb.from("grants").select("*").in("status",["open","upcoming"]).or(`deadline_at.is.null,deadline_at.gte.${today}`).order("deadline_at",{ascending:true,nullsFirst:false}).limit(80);
    if(!active)return;
    const verified=(data||[]).filter(row=>/^https?:\/\//i.test(String(row.source_url||"")));
    const mapped=verified.map(row=>mapGrant(row,profile));
    mapped.sort((a,b)=>b.matchScore-a.matchScore);
    if(mapped.length){setGrantItems(mapped);setSel(mapped[0]);}
  })();return()=>{active=false;};},[profile,company?.id]);
  useEffect(()=>{let active=true;(async()=>{const{data}=await sb.from("data_source_health").select("source,last_success,last_failure,failure_count,last_error,updated_at").order("source");if(active)setSourceHealth(data||[]);})();return()=>{active=false;};},[]);
  useEffect(()=>{if(!maticna)return;let active=true;(async()=>{const{data}=await sb.from("companies").select("id,company_name").eq("registration_number",maticna).maybeSingle();if(active)setCompany(data||null);})();return()=>{active=false;};},[maticna]);
  useEffect(()=>{const filtered=filterGrants(grantItems,af);if(filtered.length&&!filtered.some(g=>g.id===sel?.id)){setSel(filtered[0]);setShowD(true);}},[af,grantItems,sel?.id]);
  const filteredGrants=filterGrants(grantItems,af);
  const selectedIsTop=filteredGrants[0]?.id===sel?.id;
  const matchedCount=grantItems.filter(g=>g.matchScore>=60).length;
  const alertsCount=computeAlerts(grantItems).total;
  const nav=[{icon:LayoutGrid,label:"Pregled"},{icon:FileText,label:"Razpisi"},{icon:Layers,label:"Priložnosti zame",badge:matchedCount||undefined},{icon:User,label:"Moj profil"},{icon:Bell,label:"Opozorila",badge:alertsCount||undefined},{icon:Calendar,label:"Koledar rokov"},{icon:Bot,label:"AI pomočnik"}];

  // Kompakten pregled: samo obstoječi, že izračunani podatki — nič se ne izmišljuje.
  // Če katerega podatka (še) ni na voljo, metrika izpade namesto lažnega "0".
  const nearestDeadlineGrant=nearestUpcomingDeadline(grantItems);
  const refreshTimestamps=sourceHealth.map(s=>s.last_success?new Date(s.last_success).getTime():NaN).filter(Number.isFinite);
  const lastRefreshDate=refreshTimestamps.length?new Date(Math.max(...refreshTimestamps)):null;
  const fmtRefresh=d=>`${d.toLocaleDateString("sl-SI",{day:"2-digit",month:"2-digit"})} · ${d.toLocaleTimeString("sl-SI",{hour:"2-digit",minute:"2-digit"})}`;
  const overviewMetrics=[
    {label:"Priložnosti",value:matchedCount},
    {label:"Opozorila",value:alertsCount},
    {label:"Najbližji rok",value:nearestDeadlineGrant?formatGrantDate(nearestDeadlineGrant.deadlineAt):null},
    {label:"Zadnja osvežitev",value:lastRefreshDate?fmtRefresh(lastRefreshDate):null},
  ].filter(m=>m.value!==null&&m.value!==undefined);

  // Filter vrstica: pokaži namig za podrsanje samo, če dejansko ne gre vse v širino.
  const filterRef=useRef(null);
  const[filterOverflow,setFilterOverflow]=useState(false);
  useEffect(()=>{
    const check=()=>{const el=filterRef.current;if(el)setFilterOverflow(el.scrollWidth>el.clientWidth+2);};
    check();
    window.addEventListener("resize",check);
    return()=>window.removeEventListener("resize",check);
  },[isMobile]);
  return(<div style={{display:"flex",flexDirection:isMobile?"column":"row",minHeight:"100vh",height:isMobile?"auto":"100vh",width:"100%",fontFamily:f,background:c.ivory,color:c.t1,overflow:isMobile?"visible":"hidden"}}>
    <aside style={{width:isMobile?"100%":"clamp(200px,17vw,250px)",minWidth:isMobile?0:200,flexShrink:0,background:c.graphite,display:"flex",flexDirection:"column",padding:isMobile?"14px 12px":"28px 14px 20px",justifyContent:"space-between",position:isMobile?"sticky":"relative",top:0,zIndex:41}}><div><div style={{display:"flex",alignItems:"center",gap:12,paddingLeft:isMobile?4:10,marginBottom:isMobile?12:8}}><div style={{width:38,height:38,borderRadius:radius.sm,background:c.olive,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:14,color:c.white,flexShrink:0}}>AI</div><div><div style={{color:c.white,fontWeight:700,fontSize:16}}>RAZPISI</div><div style={{color:`${c.white}80`,fontSize:11}}>Pametno do sredstev</div></div></div><div style={{position:"relative"}}><nav style={{marginTop:isMobile?0:32,display:"flex",flexDirection:isMobile?"row":"column",gap:isMobile?4:1,overflowX:isMobile?"auto":"visible",paddingBottom:isMobile?2:0}}>{nav.map(n=>{const a=navSel===n.label;return(<div key={n.label} onClick={()=>{if(!n.soon)setNavSel(n.label);}} style={{display:"flex",alignItems:"center",gap:isMobile?8:11,padding:isMobile?"9px 10px":"10px 10px",borderLeft:isMobile?"none":`2px solid ${a?c.olive:"transparent"}`,borderBottom:isMobile?`2px solid ${a?c.olive:"transparent"}`:"none",cursor:n.soon?"default":"pointer",background:"transparent",flexShrink:0,opacity:n.soon?.55:1}}><n.icon size={17} strokeWidth={1.75} color={a?c.white:`${c.white}45`}/><span style={{fontSize:14,fontWeight:a?600:450,color:a?c.white:`${c.white}60`,flex:1,whiteSpace:"nowrap"}}>{isMobile&&n.label.length>12?n.label.split(" ")[0]:n.label}</span>{n.soon&&<span style={{color:`${c.white}70`,fontSize:9,fontWeight:700,letterSpacing:".05em"}}>KMALU</span>}{!n.soon&&n.badge&&<span style={{border:`1px solid ${a?c.white:c.olive}66`,color:a?c.white:c.olive,fontSize:11,fontWeight:700,borderRadius:radius.xs,padding:"1px 7px",...tnum}}>{n.badge}</span>}</div>);})}</nav>{isMobile&&<div style={{position:"absolute",top:0,right:0,bottom:2,width:26,background:`linear-gradient(90deg, transparent, ${c.graphite})`,pointerEvents:"none",display:"flex",alignItems:"center",justifyContent:"flex-end"}}><ChevronRight size={14} color={`${c.white}70`}/></div>}</div></div>{!isMobile&&<div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 10px"}}><div style={{width:34,height:34,borderRadius:radius.sm,background:c.olive,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:14,color:c.white,flexShrink:0}}>{(company?.company_name||"P").charAt(0)}</div><div style={{flex:1,minWidth:0}}><div style={{color:c.white,fontSize:13,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{company?.company_name||"Profil podjetja"}</div><div style={{color:`${c.white}55`,fontSize:11}}>Moj profil</div></div></div>}</aside>
    <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",overflow:isMobile?"visible":"hidden"}}>
      <header style={{display:"flex",alignItems:"center",gap:12,padding:isMobile?"12px 16px":"16px 28px",background:c.white,borderBottom:`1px solid ${c.border}`}}><div style={{flexGrow:isMobile?1:0,flexShrink:1,flexBasis:isMobile?"auto":"min(58%,780px)",display:"flex",alignItems:"center",gap:10,background:c.ivory,border:`1px solid ${c.border}`,borderRadius:radius.md,padding:"12px 16px",height:48,minWidth:0}}><Search size={18} color={c.t3}/><input placeholder="Išči po razpisih …" style={{border:"none",background:"transparent",outline:"none",fontSize:14,color:c.t1,fontFamily:f,flex:1,minWidth:0}}/></div>{!isMobile&&<div style={{flex:1}}/>}<div onClick={()=>setNavSel("Opozorila")} style={{position:"relative",cursor:"pointer",flexShrink:0}}><Bell size={20} color={c.t2}/>{alertsCount>0&&<span style={{position:"absolute",top:-4,right:-4,width:16,height:16,borderRadius:"50%",background:c.coral,color:c.white,fontSize:9,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>{alertsCount>9?"9+":alertsCount}</span>}</div></header>
      <div style={{flex:1,minWidth:0,display:"flex",flexDirection:isMobile?"column":"row",overflow:isMobile?"visible":"hidden"}}>
        {navSel==="Moj profil"&&<div style={{flex:1,overflowY:isMobile?"visible":"auto"}}><CompanyProfile maticna={maticna} grantItems={grantItems} onGoToGrants={()=>setNavSel("Pregled")}/></div>}
        {navSel==="Koledar rokov"&&<DeadlineCalendar grantItems={grantItems} onSelect={g=>{setSel(g);setShowD(true);}}/>}
        {navSel==="Opozorila"&&<AlertsView grantItems={grantItems} onSelect={g=>{setSel(g);setShowD(true);}}/>}
        {navSel==="AI pomočnik"&&<AiAssistantChat companyId={company?.id}/>}
        {navSel!=="Moj profil"&&navSel!=="Koledar rokov"&&navSel!=="Opozorila"&&navSel!=="AI pomočnik"&&<div style={{flex:1,minWidth:0,overflowY:isMobile?"visible":"auto",padding:isMobile?"18px 16px 28px":"28px 28px 40px"}}>
          <div style={{marginBottom:28}}>
            <div style={{fontSize:11,fontWeight:700,letterSpacing:".05em",color:c.t3,marginBottom:14}}>PREGLED</div>
            <div style={{display:isMobile?"grid":"flex",gridTemplateColumns:isMobile?"1fr 1fr":undefined,rowGap:isMobile?18:0}}>
              {overviewMetrics.map((m,i)=>(
                <div key={m.label} style={{minWidth:0,flex:isMobile?undefined:1,paddingLeft:!isMobile&&i>0?24:0,paddingRight:!isMobile?24:0,borderLeft:!isMobile&&i>0?`1px solid ${c.border}`:"none"}}>
                  <div style={{fontSize:isMobile?21:25,fontWeight:700,color:c.t1,lineHeight:1.15,...tnum}}>{m.value}</div>
                  <div style={{fontSize:12,color:c.t2,marginTop:4}}>{m.label}</div>
                </div>
              ))}
            </div>
          </div>
          <SourceHealthPanel items={sourceHealth} isMobile={isMobile}/>
          <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",gap:12,marginBottom:14}}><h2 style={{fontSize:20,fontWeight:700}}>Priložnosti za vas</h2><span style={{fontSize:12,color:c.t3,...tnum}}>{filteredGrants.length} / {grantItems.length} aktualnih</span></div>
          <div style={{position:"relative",marginBottom:18}}>
            <div ref={filterRef} style={{display:"flex",gap:18,overflowX:isMobile?"auto":"visible",flexWrap:isMobile?"nowrap":"wrap",rowGap:8,borderBottom:`1px solid ${c.border}`,paddingBottom:0}}>
              {grantFilters.map(fi=>{const active=af===fi;return(
                <button key={fi} onClick={()=>setAf(fi)} style={{padding:"0 0 9px",border:"none",borderBottom:`2px solid ${active?c.olive:"transparent"}`,background:"transparent",fontSize:13,fontWeight:active?600:450,fontFamily:f,cursor:"pointer",color:active?c.t1:c.t2,whiteSpace:"nowrap",flexShrink:0}}>{fi}</button>
              );})}
            </div>
            {filterOverflow&&<div style={{position:"absolute",top:0,right:0,bottom:9,width:26,background:`linear-gradient(90deg, transparent, ${c.ivory})`,pointerEvents:"none"}}/>}
          </div>
          {filteredGrants.length===0?<div style={{padding:"28px 22px",borderRadius:radius.md,border:`1px solid ${c.border}`,color:c.t2,fontSize:13}}>Za ta filter trenutno ni aktualnih razpisov.</div>:(
          <div style={{borderTop:`1px solid ${c.border}`}}>{filteredGrants.map(g=>{
            const isSel=sel?.id===g.id;const isTop=filteredGrants[0]?.id===g.id;
            const urgency=deadlineUrgency(g.deadlineAt);
            const hasDeadline=g.deadline!=="brez roka";
            return(
            <div key={g.id} onClick={()=>{setSel(g);setShowD(true);}} style={{display:"grid",gridTemplateColumns:isMobile?"minmax(0,1fr)":"64px minmax(0,1fr) auto 18px",alignItems:"center",gap:isMobile?10:20,padding:isMobile?"16px 4px":"16px 6px",borderBottom:`1px solid ${c.border}`,background:isSel?c.oliveLight:"transparent",cursor:"pointer"}}>
              {!isMobile&&<Score value={g.matchScore}/>}
              <div style={{minWidth:0}}>
                {isTop&&<div style={{fontSize:10,fontWeight:700,letterSpacing:".05em",color:c.olive,marginBottom:5}}>TOP UJEMANJE</div>}
                <div style={{display:"flex",alignItems:"flex-start",gap:8,marginBottom:4}}><GrantIcon type={g.icon}/><div style={{fontSize:15,fontWeight:600,color:c.t1,lineHeight:1.3,minWidth:0,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{g.title}</div></div>
                <MetaLine parts={[...g.tags,g.funder,`preverjeno ${g.lastChecked}`]}/>
                <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                  {g.status==="open"&&<Tag label="ODPRTO" variant="status"/>}
                  {g.status==="upcoming"&&<Tag label="NAPOVEDAN" variant="deadline"/>}
                  <Tag label={g.fundingType.toUpperCase()} variant="quality"/>
                  {hasDeadline&&urgency.level==="urgent"&&<Tag label={`ROK ${g.deadline}`} variant="deadline"/>}
                  {g.qualityStatus!=="verified"&&<Tag label={g.qualityLabel} variant="quality"/>}
                </div>
                {isMobile&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,marginTop:10}}><Score value={g.matchScore}/><div style={{textAlign:"right"}}><div style={{fontSize:14,fontWeight:700,color:c.t1,...tnum}}>{g.amountLabel}</div>{hasDeadline&&<div style={{fontSize:11,marginTop:2,...tnum,color:urgency.level==="urgent"?c.coral:urgency.level==="soon"?c.amber:c.t2,fontWeight:urgency.level==="urgent"||urgency.level==="soon"?700:400}}>{g.deadline}</div>}</div></div>}
              </div>
              {!isMobile&&<div style={{textAlign:"right",flexShrink:0}}><div style={{fontSize:14,fontWeight:700,color:c.t1,...tnum}}>{g.amountLabel}</div><div style={{fontSize:11,marginTop:2,...tnum,color:urgency.level==="urgent"?c.coral:urgency.level==="soon"?c.amber:c.t2,fontWeight:urgency.level==="urgent"||urgency.level==="soon"?700:400}}>{hasDeadline?g.deadline:g.fundingType}</div></div>}
              {!isMobile&&<ChevronRight size={16} color={c.t3}/>}
            </div>
          );})}</div>
          )}
        </div>}
        {navSel!=="Moj profil"&&navSel!=="AI pomočnik"&&showD&&sel&&(()=>{
          // Uradni vir → AI razlaga: prikažemo dvoje ločeno samo, kadar imamo resnično oboje
          // (surov/uraden tekst IN ločen AI povzetek) — sicer en sam, obstoječi povzetek.
          const officialRaw=(sel.officialText||"").trim();
          const aiText=String(sel.aiSummary||"").trim();
          const hasDocPair=sel.hasAiSummary&&officialRaw&&officialRaw!==aiText;
          const officialQuote=officialRaw.length>260?officialRaw.slice(0,260).replace(/\s+\S*$/,"")+" …":officialRaw;
          const overlay=!isMobile&&isCompact;
          const selUrgency=deadlineUrgency(sel.deadlineAt);
          const selHasDeadline=sel.deadline!=="brez roka";
          // Največ 4 značke: status, do 2 ključni kategoriji, rok (samo če je res blizu) in
          // "PREGLED" samo kadar gre za izjemo (podatek ni preverjen) — "PREVERJENO" se ne prikazuje več
          // kot stalna značka na vsakem razpisu, ker privzetega stanja ni treba označevati.
          const drawerBadges=[
            sel.status==="open"?{key:"status",label:"ODPRTO",variant:"status"}:sel.status==="upcoming"?{key:"status",label:"NAPOVEDAN",variant:"deadline"}:null,
            ...sel.tags.slice(0,2).map(t=>({key:t,label:t})),
            selHasDeadline&&selUrgency.level==="urgent"?{key:"rok",label:`ROK ${sel.deadline}`,variant:"deadline"}:null,
            sel.qualityStatus!=="verified"?{key:"quality",label:sel.qualityLabel,variant:"quality"}:null,
          ].filter(Boolean).slice(0,4);
          return(<>
            {overlay&&<div onClick={()=>setShowD(false)} style={{position:"fixed",inset:0,background:"rgba(7,16,20,0.35)",zIndex:39}}/>}
            <aside style={{width:isMobile?"100%":overlay?"clamp(340px,88vw,440px)":420,minWidth:isMobile||overlay?0:420,flexShrink:0,position:overlay?"fixed":"static",top:overlay?0:"auto",right:overlay?0:"auto",bottom:overlay?0:"auto",zIndex:overlay?40:"auto",boxShadow:overlay?"-12px 0 32px rgba(7,16,20,0.16)":"none",borderLeft:isMobile||overlay?"none":`1px solid ${c.border}`,borderTop:isMobile?`1px solid ${c.border}`:"none",background:c.white,overflowY:isMobile?"visible":"auto",padding:isMobile?"22px 16px 36px":"24px 26px 40px"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:18}}>{selectedIsTop?<span style={{background:c.olive,color:c.white,fontSize:10,fontWeight:700,padding:"4px 12px",borderRadius:radius.xs}}>TOP UJEMANJE</span>:<div/>}<div onClick={()=>setShowD(false)} style={{width:32,height:32,borderRadius:radius.sm,background:c.ivory,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}><X size={16} color={c.t2}/></div></div>
              <h3 style={{fontSize:isMobile?19:21,fontWeight:700,lineHeight:1.25,color:c.t1,marginBottom:6}}>{sel.title}</h3>
              <div style={{fontSize:13,color:c.t2,marginBottom:14}}>{sel.funder}</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:22}}>{drawerBadges.map(b=><Tag key={b.key} label={b.label} variant={b.variant}/>)}</div>
              <div style={{marginBottom:24}}>{hasDocPair?(
                <DocumentTransition quoteSource="Uradni vir" quote={`„${officialQuote}"`} explanationLabel="AI razlaga" explanation={aiText}/>
              ):(
                <AIExplanation label={sel.hasAiSummary?"AI razlaga":"Povzetek razpisa"}>{aiText}</AIExplanation>
              )}</div>
              <div style={{marginBottom:22}}><div style={{fontSize:11,fontWeight:700,letterSpacing:".04em",color:c.t1,marginBottom:6}}>OSNOVNE INFORMACIJE</div>
                <DataList rows={[["Višina",sel.amountLabel.toLowerCase()],["Sofinanciranje",sel.cofinancing],["Rok",sel.deadline],["Tip",sel.fundingType],["Regija",sel.region],["Vir",sel.sourceName],["Preverjeno",sel.lastChecked]]}/>
              </div>
              <div style={{marginBottom:26}}><div style={{fontSize:11,fontWeight:700,letterSpacing:".04em",color:c.t1,marginBottom:14}}>KAKOVOST PODATKOV</div><div style={{display:"flex",flexDirection:isMobile?"column":"row",gap:isMobile?16:28,alignItems:isMobile?"flex-start":"center"}}><Score value={sel.matchScore} size="lg"/><div style={{display:"flex",flexDirection:"column",gap:7}}>{sel.checklist.map(item=><div key={item.label} style={{display:"flex",alignItems:"center",gap:8,fontSize:13}}><Check size={15} strokeWidth={2.5} color={item.p?c.olive:c.t3}/><span style={{color:item.p?c.t1:c.t3}}>{item.label}</span></div>)}</div></div></div>
              <div style={{display:"flex",flexDirection:isMobile?"column":"row",gap:10}}><button onClick={()=>sel.sourceUrl&&window.open(sel.sourceUrl,"_blank","noopener,noreferrer")} disabled={!sel.sourceUrl} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"13px 20px",borderRadius:radius.md,border:"none",background:sel.sourceUrl?c.graphite:c.border,color:c.white,fontSize:13,fontWeight:600,cursor:sel.sourceUrl?"pointer":"not-allowed",fontFamily:f}}>VIR RAZPISA <ExternalLink size={14}/></button><button style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"13px 20px",borderRadius:radius.md,border:`1px solid ${c.t1}`,background:"transparent",color:c.t1,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:f}}>SHRANI <Bookmark size={14}/></button></div>
            </aside>
          </>);
        })()}
      </div>
    </div>
  </div>);
}

/* ═══════════════════════════════════════════════════ */
/*  APP ROUTER                                        */
/* ═══════════════════════════════════════════════════ */
export default function App(){
  if(!sb)return(<div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"system-ui",color:"#333"}}><div style={{textAlign:"center"}}><h2>Manjkajo okoljske spremenljivke</h2><p style={{color:"#666"}}>VITE_SUPABASE_URL in VITE_SUPABASE_ANON_KEY nista nastavljeni.</p></div></div>);
  const [mode,setMode]=useState("landing");
  const [maticna,setMaticna]=useState("1234567000");
  const [profile,setProfile]=useState(null);
  const go=p=>{setMode(p);window.scrollTo?.(0,0);};
  if(mode==="landing") return <Landing go={go} onStart={()=>go("onboarding")}/>;
  if(mode==="kako") return <HowItWorks go={go} onStart={()=>go("onboarding")}/>;
  if(mode==="cenik") return <Pricing go={go} onStart={()=>go("onboarding")}/>;
  if(mode==="onboarding") return <Onboarding onComplete={(prof)=>{const m=typeof prof==="object"?prof?.maticna:prof;if(m)setMaticna(m);setProfile(typeof prof==="object"&&prof?.maticna?prof:null);go("dashboard");}} onBack={()=>go("landing")}/>;
  return <Dashboard maticna={maticna} profile={profile}/>;
}
