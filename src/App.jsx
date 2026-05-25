import { useState, useEffect, useRef } from "react";
import {
  LayoutGrid,FileText,Sparkles,User,Bell,Calendar,Bot,Search,
  ChevronRight,ChevronDown,X,ExternalLink,Bookmark,Check,Filter,
  BarChart3,Globe,Clock,Coins,MapPin,Building2,TrendingUp,
  Zap,Shield,Loader2,ArrowRight,Cpu,Leaf,FlaskConical,Users,
  Building,GraduationCap,ChevronLeft,Pencil,Timer,Eye,Lock,
  Layers,MessageSquare,BellRing,Database,FileSearch,ArrowUpRight,
  Minus,CircleCheck,CircleX,ChevronUp,
} from "lucide-react";
import{createClient}from"@supabase/supabase-js";
const sb=import.meta.env.VITE_SUPABASE_URL
  ?createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_ANON_KEY)
  :null;

/* ═══ TOKENS ═══════════════════════════════════════ */
const c={graphite:"#071014",ivory:"#F7F4EC",cream:"#EFEADF",olive:"#7F9656",oliveLight:"rgba(127,150,86,0.08)",oliveMed:"rgba(127,150,86,0.15)",amber:"#D9A441",amberLight:"rgba(217,164,65,0.12)",border:"#DDD7C8",t1:"#101418",t2:"#62645F",t3:"#8A8A82",white:"#FFFFFF",signal:"#5B7CFA",signalLight:"rgba(91,124,250,0.12)",coral:"#C85A3A"};
const f="'Inter',system-ui,-apple-system,sans-serif";

function useIsMobile(){
  const get=()=>typeof window!=="undefined"&&window.matchMedia("(max-width: 760px)").matches;
  const[isMobile,setIsMobile]=useState(get);
  useEffect(()=>{if(typeof window==="undefined")return;const mq=window.matchMedia("(max-width: 760px)");const on=()=>setIsMobile(mq.matches);on();mq.addEventListener?.("change",on);return()=>mq.removeEventListener?.("change",on);},[]);
  return isMobile;
}

/* ═══ SHARED NAV ═══════════════════════════════════ */
function Nav({page,go,onStart}){
  const isMobile=useIsMobile();
  return(
    <nav style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:isMobile?"14px 16px":"18px 40px",background:`${c.white}cc`,backdropFilter:"blur(12px)",borderBottom:`1px solid ${c.border}50`,position:"sticky",top:0,zIndex:50,fontFamily:f}}>
      <div style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}} onClick={()=>go("landing")}>
        <div style={{width:36,height:36,borderRadius:10,background:c.olive,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:14,color:c.white}}>AI</div>
        <span style={{fontSize:18,fontWeight:700,color:c.t1}}>RAZPISI</span>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:isMobile?10:32}}>
        {[["kako","Kako deluje"],["cenik","Cenik"]].map(([k,l])=>(
          <a key={k} onClick={()=>go(k)} style={{display:isMobile&&k==="kako"?"none":"inline",fontSize:14,color:page===k?c.olive:c.t2,fontWeight:page===k?600:500,cursor:"pointer",textDecoration:"none",borderBottom:page===k?`2px solid ${c.olive}`:"2px solid transparent",paddingBottom:2}}>{l}</a>
        ))}
        <button onClick={onStart} style={{padding:isMobile?"10px 14px":"10px 24px",borderRadius:10,border:"none",background:c.graphite,color:c.white,fontSize:isMobile?13:14,fontWeight:600,cursor:"pointer",fontFamily:f,whiteSpace:"nowrap"}}>{isMobile?"Začni":"Začni brezplačno"}</button>
      </div>
    </nav>
  );
}

function Footer(){
  const isMobile=useIsMobile();
  return(
    <footer style={{borderTop:`1px solid ${c.border}`,padding:isMobile?"24px 16px":"32px 40px",display:"flex",flexDirection:isMobile?"column":"row",gap:10,justifyContent:"space-between",alignItems:"center",fontFamily:f}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:28,height:28,borderRadius:8,background:c.olive,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:10,color:c.white}}>AI</div><span style={{fontSize:14,fontWeight:600,color:c.t1}}>RAZPISI</span></div>
      <span style={{fontSize:12,color:c.t3}}>© 2026 AI Razpisi · Slovenija</span>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════ */
/*  LANDING PAGE                                      */
/* ═══════════════════════════════════════════════════ */
function Landing({go,onStart}){
  const isMobile=useIsMobile();
  const sec={maxWidth:1080,margin:"0 auto",padding:isMobile?"0 16px":"0 32px"};
  return(
    <div style={{fontFamily:f,color:c.t1,background:c.ivory}}>
      <Nav page="landing" go={go} onStart={onStart}/>
      <section style={{...sec,padding:isMobile?"56px 16px 48px":"100px 32px 80px",textAlign:"center"}}>
        <div style={{display:"inline-flex",alignItems:"center",gap:8,padding:"6px 16px",borderRadius:8,background:c.oliveLight,border:`1px solid ${c.olive}20`,marginBottom:24}}><Sparkles size={14} color={c.olive}/><span style={{fontSize:13,fontWeight:600,color:c.olive}}>AI platforma za slovenske razpise</span></div>
        <h1 style={{fontSize:isMobile?36:52,fontWeight:700,lineHeight:1.08,color:c.t1,marginBottom:16,maxWidth:700,margin:"0 auto 16px"}}>AI prevod birokratskega jezika. <span style={{color:c.olive}}>Prave priložnosti.</span></h1>
        <p style={{fontSize:isMobile?16:18,color:c.t2,lineHeight:1.6,maxWidth:540,margin:"0 auto 36px"}}>Vpišite matično številko. Sistem pridobi podatke, preveri de minimis stanje in predlaga razpise, ki ustrezajo vašemu podjetju.</p>
        <div style={{display:"flex",flexDirection:isMobile?"column":"row",gap:12,justifyContent:"center"}}>
          <button onClick={onStart} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,padding:"16px 36px",borderRadius:14,border:"none",background:c.olive,color:c.white,fontSize:16,fontWeight:700,cursor:"pointer",fontFamily:f,boxShadow:`0 4px 24px ${c.olive}35`}}>Preveri razpise <ArrowRight size={20}/></button>
          <button onClick={()=>go("kako")} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"16px 28px",borderRadius:14,border:`1.5px solid ${c.border}`,background:c.white,color:c.t1,fontSize:16,fontWeight:600,cursor:"pointer",fontFamily:f}}>Kako deluje</button>
        </div>
        <div style={{display:"flex",flexDirection:isMobile?"column":"row",justifyContent:"center",gap:isMobile?10:40,marginTop:48,opacity:.5}}>{["148 razpisov","95 % natančnost matchinga","Pod 2 min onboarding"].map(t=><span key={t} style={{fontSize:13,fontWeight:500,color:c.t2}}>{t}</span>)}</div>
      </section>

      {/* Before/After teaser */}
      <section style={{...sec,padding:isMobile?"36px 16px 56px":"60px 32px 80px"}}>
        <div style={{display:"flex",flexDirection:isMobile?"column":"row",gap:20,maxWidth:800,margin:"0 auto"}}>
          <div style={{flex:1,background:c.white,border:`1px solid ${c.border}`,borderRadius:16,padding:"28px 24px"}}><div style={{fontSize:11,fontWeight:700,letterSpacing:".04em",color:c.coral,marginBottom:12}}>URADNI RAZPIS</div><div style={{fontSize:13,color:c.t2,lineHeight:1.7,fontStyle:"italic"}}>„Upravičeni stroški so stroški nakupa opredmetenih in neopredmetenih osnovnih sredstev, ki so neposredno povezani z izvajanjem operacije …"</div></div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",transform:isMobile?"rotate(90deg)":"none"}}><ArrowRight size={24} color={c.olive}/></div>
          <div style={{flex:1,background:c.white,border:`1px solid ${c.olive}30`,borderLeft:`4px solid ${c.olive}`,borderRadius:16,padding:"28px 24px"}}><div style={{fontSize:11,fontWeight:700,letterSpacing:".04em",color:c.olive,marginBottom:12}}>AI PREVOD</div><div style={{fontSize:14,color:c.t1,lineHeight:1.7}}>Kupite lahko novo opremo ali programsko opremo za digitalizacijo. Sistem pokrije stroške do 75.000 €. Pogoj: oprema mora biti nova.</div></div>
        </div>
        <div style={{textAlign:"center",marginTop:24}}><a onClick={()=>go("kako")} style={{fontSize:14,fontWeight:600,color:c.olive,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6}}>Več o delovanju platforme <ArrowRight size={16}/></a></div>
      </section>

      {/* Pricing teaser */}
      <section style={{background:c.white,padding:"80px 0"}}>
        <div style={sec}>
          <h2 style={{fontSize:34,fontWeight:700,textAlign:"center",color:c.t1,marginBottom:12}}>Od 0 € naprej</h2>
          <p style={{textAlign:"center",fontSize:15,color:c.t2,marginBottom:32}}>Brezplačni paket za pregled. Plačljivi paketi za polno AI izkušnjo.</p>
          <div style={{display:"flex",flexDirection:isMobile?"column":"row",justifyContent:"center",gap:24}}>
            {[["Brezplačno","0 €","Pregled razpisov"],["Osnovno","19 €/mes","AI matching"],["Profesionalno","49 €/mes","Polna AI izkušnja"],["Svetovalci","99 €/mes","Več podjetij"]].map(([n,p,d])=>(
              <div key={n} style={{padding:"20px 24px",borderRadius:14,border:`1px solid ${c.border}`,background:c.ivory,minWidth:150,textAlign:"center"}}><div style={{fontSize:11,fontWeight:700,color:c.t3,letterSpacing:".04em",marginBottom:8}}>{n}</div><div style={{fontSize:24,fontWeight:800,color:c.t1,marginBottom:4}}>{p}</div><div style={{fontSize:12,color:c.t2}}>{d}</div></div>
            ))}
          </div>
          <div style={{textAlign:"center",marginTop:28}}><a onClick={()=>go("cenik")} style={{fontSize:14,fontWeight:600,color:c.olive,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6}}>Poglej celoten cenik <ArrowRight size={16}/></a></div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section style={{...sec,padding:isMobile?"56px 16px":"80px 32px",textAlign:"center"}}>
        <h2 style={{fontSize:30,fontWeight:700,color:c.t1,marginBottom:12}}>Pripravljeni?</h2>
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
  const card={background:c.white,border:`1px solid ${c.border}`,borderRadius:16,padding:isMobile?"22px 18px":"28px 26px",marginBottom:16};
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
            desc:"Vpišete matično (8 mest) ali davčno (10 mest) številko. Sistem avtomatsko prepozna format in sproži pridobivanje podatkov iz treh virov.",
            detail:[
              {src:"AJPES ePRS",what:"Firma, naslov, SKD šifre dejavnosti, pravna oblika, datum vpisa, velikostni razred",Icon:Database},
              {src:"JODP (Ministrstvo za finance)",what:"Celotna zgodovina prejetih državnih in de minimis pomoči z zneski in datumi",Icon:Shield},
              {src:"VIES (EU)",what:"Validacija davčne številke in potrditev aktivnega zavezanca",Icon:Globe},
            ]},
          {num:"02",title:"Potrdite profil",Icon:Check,color:"c-olive",
            desc:"Vse je predizpolnjeno. Preverite podatke iz registra, potrdite de minimis stanje in dodajte 3 številke za KMU klasifikacijo.",
            detail:[
              {src:"Avtomatsko iz registra",what:"Firma, naslov → regija NUTS-2, SKD šifre → dejavnosti, pravna oblika, starost podjetja",Icon:FileSearch},
              {src:"KMU klasifikacija",what:"Število zaposlenih + letni prihodek + bilančna vsota → mikro / malo / srednje podjetje po EU merilih (2003/361/ES)",Icon:BarChart3},
              {src:"Strateški interesi",what:"AI predlaga kategorije na podlagi SKD kode. Vi potrdite ali prilagodite: digitalizacija, izvoz, zeleni prehod, R&D …",Icon:Sparkles},
            ]},
          {num:"03",title:"Prejmite priložnosti",Icon:Sparkles,color:"c-green",
            desc:"Matching engine primerja vaš profil z vsemi odprtimi razpisi po petih oseh. V sekundi vidite, kaj je za vas.",
            detail:[
              {src:"SKD ujemanje",what:"Vaše registrirane dejavnosti ↔ upravičene SKD kode v razpisu",Icon:Layers},
              {src:"KMU + regija + de minimis",what:"Velikost podjetja, lokacija in preostali de minimis prostor ↔ pogoji razpisa",Icon:Shield},
              {src:"Interesi + AI ocena",what:"Vaši strateški cilji ↔ namen razpisa. AI prevede birokratski jezik v pogovorni.",Icon:MessageSquare},
            ]},
        ].map((step,si)=>(
          <div key={step.num} style={{...card,padding:isMobile?"24px 18px":"36px 32px",marginBottom:24}}>
            <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:20}}>
              <div style={{width:48,height:48,borderRadius:14,background:c.oliveMed,display:"flex",alignItems:"center",justifyContent:"center"}}><step.Icon size={22} color={c.olive} strokeWidth={2}/></div>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:c.olive,marginBottom:2}}>{step.num}</div>
                <h2 style={{fontSize:22,fontWeight:700,color:c.t1}}>{step.title}</h2>
              </div>
            </div>
            <p style={{fontSize:15,color:c.t2,lineHeight:1.6,marginBottom:20,maxWidth:640}}>{step.desc}</p>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {step.detail.map(d=>(
                <div key={d.src} style={{display:"flex",alignItems:"flex-start",gap:14,padding:"16px 18px",borderRadius:12,background:c.ivory,border:`1px solid ${c.border}50`}}>
                  <div style={{width:36,height:36,borderRadius:10,background:c.white,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,border:`1px solid ${c.border}`}}><d.Icon size={16} color={c.olive} strokeWidth={1.75}/></div>
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
          <div style={{display:"flex",flexDirection:isMobile?"column":"row",gap:16}}>
            {[
              {n:"300.000 €",d:"Nova meja de minimis pomoči po Uredbi EU 2023/2831, veljavna od 1. 1. 2024.",color:c.olive},
              {n:"3 leta",d:"Referenčno obdobje. Seštejejo se pomoči v tekočem in dveh predhodnih fiskalnih letih.",color:c.amber},
              {n:"Od 1. 1. 2026",d:"EU zahteva javno dostopen centralni register. Slovenija vzpostavlja strojno berljiv vir.",color:c.signal},
            ].map(b=>(
              <div key={b.n} style={{flex:1,padding:"24px 22px",borderRadius:14,border:`1px solid ${c.border}`,background:c.ivory}}>
                <div style={{fontSize:28,fontWeight:800,color:b.color,marginBottom:8}}>{b.n}</div>
                <div style={{fontSize:13,color:c.t2,lineHeight:1.5}}>{b.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Matching osi */}
      <section style={{...sec,padding:isMobile?"48px 16px":"64px 32px"}}>
        <h2 style={{fontSize:28,fontWeight:700,color:c.t1,marginBottom:8}}>5 osi matchinga</h2>
        <p style={{fontSize:15,color:c.t2,lineHeight:1.6,marginBottom:32,maxWidth:640}}>Vsak razpis je ocenjen po petih kriterijih. Rezultat je match score (%) in checklist, ki pokaže, kje ste upravičeni in kje ne.</p>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {[
            {n:"SKD dejavnost",d:"Vaše registrirane dejavnosti ↔ upravičene SKD kode razpisa. Primerja glavno in vse registrirane.",Icon:Layers,w:"35%"},
            {n:"KMU status",d:"Mikro, malo ali srednje podjetje po EU definiciji. Binaren filter — večina razpisov zahteva KMU.",Icon:Building2,w:"25%"},
            {n:"Regija",d:"Vzhodna ali Zahodna Slovenija (NUTS-2). Nekateri razpisi so regionalno omejeni ali dajejo prednost kohezijski regiji.",Icon:MapPin,w:"15%"},
            {n:"De minimis prostor",d:"Preostali prostor do 300.000 €. Če razpis presega vaš prostor, to vpliva na score.",Icon:Shield,w:"15%"},
            {n:"Strateški interesi",d:"Vaši izbrani cilji ↔ namen razpisa. Digitalizacija, izvoz, zeleni prehod, R&D.",Icon:Sparkles,w:"10%"},
          ].map(a=>(
            <div key={a.n} style={{display:"flex",alignItems:isMobile?"flex-start":"center",gap:16,padding:"18px 20px",borderRadius:14,background:c.white,border:`1px solid ${c.border}`}}>
              <div style={{width:40,height:40,borderRadius:10,background:c.oliveMed,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><a.Icon size={18} color={c.olive} strokeWidth={1.75}/></div>
              <div style={{flex:1}}><div style={{fontSize:14,fontWeight:600,color:c.t1,marginBottom:2}}>{a.n}</div><div style={{fontSize:13,color:c.t2,lineHeight:1.45}}>{a.d}</div></div>
              {!isMobile&&<div style={{textAlign:"right",flexShrink:0}}><div style={{fontSize:20,fontWeight:800,color:c.olive}}>{a.w}</div><div style={{fontSize:11,color:c.t3}}>utež</div></div>}
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{...sec,padding:"48px 32px 80px",textAlign:"center"}}>
        <button onClick={onStart} style={{display:"inline-flex",alignItems:"center",gap:10,padding:"16px 36px",borderRadius:14,border:"none",background:c.graphite,color:c.white,fontSize:16,fontWeight:700,cursor:"pointer",fontFamily:f}}>Začni brezplačno <ArrowRight size={20}/></button>
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
  {name:"Osnovno",price:"19",period:"/ mesec",desc:"Za podjetnike, ki želijo vedeti, kaj je na voljo.",hl:false,cta:"Preizkusi 14 dni",
   features:["Vse iz Brezplačnega","1 profil podjetja","AI matching in ujemanje %","Osnovna opozorila za roke","De minimis sledenje (JODP)","E-poštna obvestila"]},
  {name:"Profesionalno",price:"49",period:"/ mesec",desc:"Polna AI izkušnja za resen pristop k razpisom.",hl:true,cta:"Preizkusi 14 dni",
   features:["Vse iz Osnovnega","AI prevod v pogovorni jezik","AI pomočnik (vprašaj karkoli)","Napredna opozorila + koledar","Izvoz poročil (PDF)","Prioritetna podpora"]},
  {name:"Za svetovalce",price:"99",period:"/ mesec",desc:"Upravljajte razpise za več strank hkrati.",hl:false,cta:"Kontaktirajte nas",
   features:["Vse iz Profesionalnega","Do 10 profilov podjetij","Skupinski dashboard","De minimis pregled za vse","API dostop","Namenski onboarding"]},
];

const compareFeatures=[
  ["cat","Podatki in profil"],
  ["Pregled razpisov","da","da","da","da"],
  ["Filtri in iskanje","osnovno","napredno","napredno","napredno"],
  ["Profil podjetja (AJPES)","—","1","1","do 10"],
  ["De minimis sledenje (JODP)","—","da","da","da"],
  ["KMU klasifikacija","—","da","da","da"],
  ["cat","AI funkcije"],
  ["AI matching (ujemanje %)","—","da","da","da"],
  ["AI prevod v pogovorni jezik","—","—","da","da"],
  ["AI pomočnik","—","—","da","da"],
  ["cat","Opozorila in izvoz"],
  ["E-poštna obvestila","—","osnovna","napredna","napredna"],
  ["Koledar rokov","—","—","da","da"],
  ["Izvoz poročil (PDF)","—","—","da","da"],
  ["cat","Podpora"],
  ["Dokumentacija","da","da","da","da"],
  ["E-poštna podpora","—","da","da","da"],
  ["Prioritetna podpora","—","—","da","da"],
  ["Namenski onboarding","—","—","—","da"],
  ["API dostop","—","—","—","da"],
];

function Pricing({go,onStart}){
  const isMobile=useIsMobile();
  const sec={maxWidth:1080,margin:"0 auto",padding:isMobile?"0 16px":"0 32px"};
  const [openFaq,setOpenFaq]=useState(null);

  const faqs=[
    ["Ali je res brezplačno?","Da. Brezplačni paket omogoča pregled vseh razpisov in osnovne filtre brez omejitev. Ni časovne omejitve. Brez kreditne kartice."],
    ["Kaj je vključeno v 14-dnevni preizkus?","Polni dostop do izbranega paketa. Preizkus se ne podaljša avtomatsko. Pred iztekom vas obvestimo."],
    ["Kako deluje de minimis sledenje?","Sistem pridobi podatke iz JODP registra Ministrstva za finance na podlagi matične številke. Podatki so informativni — priporočamo potrditev z lastno evidenco."],
    ["Ali lahko zamenjam paket?","Kadarkoli. Nadgradnja je takojšnja, pri znižanju velja do konca tekočega obdobja."],
    ["Kakšno plačevanje sprejemate?","Kartično plačilo (Visa, Mastercard) in SEPA direktna obremenitev. Račun prejmete po e-pošti."],
    ["Ali lahko prekličem kadarkoli?","Da. Brez vezave, brez penala. Dostop velja do konca plačanega obdobja."],
  ];

  return(
    <div style={{fontFamily:f,color:c.t1,background:c.ivory}}>
      <Nav page="cenik" go={go} onStart={onStart}/>

      {/* Hero */}
      <section style={{...sec,padding:isMobile?"52px 16px 12px":"72px 32px 16px",textAlign:"center"}}>
        <h1 style={{fontSize:isMobile?34:42,fontWeight:700,lineHeight:1.1,color:c.t1,marginBottom:12}}>Cenik</h1>
        <p style={{fontSize:17,color:c.t2,maxWidth:480,margin:"0 auto"}}>Brez vezave. Brez skritih stroškov. Prekličete kadarkoli.</p>
      </section>

      {/* Cards */}
      <section style={{...sec,padding:isMobile?"32px 16px 48px":"40px 32px 56px"}}>
        <div style={{display:"flex",flexDirection:isMobile?"column":"row",gap:20,alignItems:"stretch"}}>
          {plans.map(p=>(
            <div key={p.name} style={{flex:1,borderRadius:18,border:`${p.hl?"2px":"1px"} solid ${p.hl?c.olive:c.border}`,background:p.hl?c.oliveLight:c.white,padding:"32px 26px",display:"flex",flexDirection:"column",position:"relative"}}>
              {p.hl&&<div style={{position:"absolute",top:-12,left:"50%",transform:"translateX(-50%)",background:c.olive,color:c.white,fontSize:11,fontWeight:700,padding:"4px 16px",borderRadius:6}}>PRIPOROČAMO</div>}
              <div style={{fontSize:13,fontWeight:700,color:p.hl?c.olive:c.t2,marginBottom:8}}>{p.name}</div>
              <div style={{display:"flex",alignItems:"baseline",gap:4,marginBottom:4}}>
                <span style={{fontSize:42,fontWeight:800,color:c.t1,lineHeight:1}}>{p.price}</span>
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
              <button onClick={onStart} style={{width:"100%",padding:"13px 0",borderRadius:12,border:p.hl?"none":`1.5px solid ${c.border}`,background:p.hl?c.olive:c.white,color:p.hl?c.white:c.t1,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:f}}>{p.cta}</button>
            </div>
          ))}
        </div>
        <p style={{textAlign:"center",fontSize:13,color:c.t3,marginTop:20}}>Vsi zneski brez DDV. 14-dnevni brezplačni preizkus za plačljive pakete.</p>
      </section>

      {/* Comparison table */}
      <section style={{background:c.white,padding:"64px 0"}}>
        <div style={sec}>
          <h2 style={{fontSize:28,fontWeight:700,color:c.t1,marginBottom:8,textAlign:"center"}}>Primerjava paketov</h2>
          <p style={{textAlign:"center",fontSize:15,color:c.t2,marginBottom:36}}>Podroben pregled, kaj je vključeno v vsak paket.</p>
          <div style={{borderRadius:16,border:`1px solid ${c.border}`,overflowX:isMobile?"auto":"hidden"}}>
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
        <button onClick={onStart} style={{display:"inline-flex",alignItems:"center",gap:10,padding:"16px 36px",borderRadius:14,border:"none",background:c.olive,color:c.white,fontSize:16,fontWeight:700,cursor:"pointer",fontFamily:f,boxShadow:`0 4px 24px ${c.olive}35`}}>Začni brezplačno <ArrowRight size={20}/></button>
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
  const [step,setStep]=useState(1);const [iv,setIv]=useState("");const [lc,setLc]=useState([]);const [jodpResult,setJodpResult]=useState(null);const [ajpesResult,setAjpesResult]=useState(null);
  const [emp,setEmp]=useState("18");const [rev,setRev]=useState("1.4");const [bal,setBal]=useState("0.9");
  const [sel,setSel]=useState(new Set(["digi","export"]));const ir=useRef(null);
  useEffect(()=>{if(step===1&&ir.current)ir.current.focus();},[step]);
  useEffect(()=>{if(step!==2)return;setLc([]);setAjpesResult(null);setJodpResult(null);[0,1,2,3].forEach(i=>{setTimeout(()=>setLc(p=>[...p,i]),600+i*700);});let api=false,timer=false;const go=()=>{if(api&&timer)setStep(3);};setTimeout(()=>{timer=true;go();},600+4*700+600);(async()=>{try{const[ajpes,jodp]=await Promise.allSettled([sb.functions.invoke("fetch-ajpes",{body:{registration_number:iv}}),sb.functions.invoke("fetch-jodp",{body:{registration_number:iv}})]);if(jodp.status==="fulfilled")setJodpResult(jodp.value.data);let company=ajpes.status==="fulfilled"?ajpes.value.data?.company:null;if(!company){const{data}=await sb.from("companies").select("*").eq("registration_number",iv).maybeSingle();company=data;}if(company)setAjpesResult({ok:true,company});}finally{api=true;go();}})();},[step]);
  const e=parseInt(emp)||0,r=parseFloat(rev)||0;
  const kmu=e<10&&r<2?"MIKRO":e<50&&r<10?"MALO":e<250&&r<50?"SREDNJE":"VELIKO";
  const kmuOk=e<250&&r<50;const toggleI=id=>{const s=new Set(sel);s.has(id)?s.delete(id):s.add(id);setSel(s);};
  const dmRecs=jodpResult?.records||[];const dmReceived=dmRecs.reduce((s,r)=>s+(Number(r.amount)||0),0);const dmFree=Math.max(0,300000-dmReceived);
  const btn={width:"100%",height:52,borderRadius:14,border:"none",background:c.graphite,color:c.white,fontSize:15,fontWeight:600,fontFamily:f,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8};
  const co=ajpesResult?.company;const mc={name:co?.company_name||"Podjetje ni najdeno v PRS cache",maticna:co?.registration_number||iv,taxNumber:co?.tax_number||"—",address:co?.address||"—",region:co?.region||co?.municipality||"—",nuts:co?.nuts||"—",legalForm:co?.legal_form||"—",founded:co?.founded_year||"—",age:co?.founded_year?new Date().getFullYear()-co.founded_year:"—",skdMain:co?.main_activity_code||"—",skdMainLabel:co?.main_activity_name||"—",skdOther:[]};

  if(step===1) return(<div style={{minHeight:"100vh",background:c.ivory,fontFamily:f,display:"flex",alignItems:"center",justifyContent:"center",padding:isMobile?"64px 16px 24px":24}}><div style={{width:"100%",maxWidth:480,textAlign:"center"}}><button onClick={onBack} style={{position:"absolute",top:20,left:20,background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:6,fontSize:13,color:c.t2,fontFamily:f}}><ChevronLeft size={18}/>Nazaj</button><div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:32}}><div style={{width:44,height:44,borderRadius:12,background:c.olive,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:16,color:c.white}}>AI</div><span style={{fontSize:20,fontWeight:700,color:c.t1}}>RAZPISI</span></div><h1 style={{fontSize:isMobile?25:28,fontWeight:700,lineHeight:1.15,color:c.t1,marginBottom:8}}>Vpišite matično ali davčno<br/>številko podjetja</h1><p style={{fontSize:15,color:c.t2,marginBottom:32}}>Sistem avtomatsko pridobi podatke iz AJPES registra, de minimis evidenco in preveri davčni status.</p><div style={{display:"flex",flexDirection:isMobile?"column":"row",gap:10}}><input ref={ir} value={iv} onChange={e=>setIv(e.target.value.replace(/\D/g,""))} placeholder="npr. 1234567000" style={{flex:1,height:56,border:`2px solid ${iv.length>=8?c.olive:c.border}`,borderRadius:14,padding:"0 20px",fontSize:17,fontFamily:"monospace",color:c.t1,background:c.white,outline:"none",letterSpacing:".04em",minWidth:0}} onKeyDown={e=>{if(e.key==="Enter"&&iv.length>=8)setStep(2);}}/><button onClick={()=>{if(iv.length>=8)setStep(2);}} style={{...btn,width:isMobile?"100%":"auto",padding:"0 28px",height:56,background:iv.length>=8?c.graphite:`${c.graphite}30`}}>Naprej <ArrowRight size={18}/></button></div></div></div>);

  if(step===2){const items=["AJPES poslovni register","JODP de minimis evidenca","VIES davčna validacija","SKD → človeško berljive dejavnosti"];const subs=["Firma, SKD, naslov","Prejete pomoči, zneski","Aktiven zavezanec","Mapiranje oznak"];return(<div style={{minHeight:"100vh",background:c.ivory,fontFamily:f,display:"flex",alignItems:"center",justifyContent:"center",padding:isMobile?"24px 16px":24}}><div style={{width:"100%",maxWidth:440,textAlign:"center"}}><Loader2 size={32} color={c.olive} strokeWidth={2} style={{animation:"spin 1.2s linear infinite",marginBottom:24}}/><h2 style={{fontSize:22,fontWeight:700,color:c.t1,marginBottom:32}}>Pridobivam podatke …</h2><div style={{textAlign:"left",display:"flex",flexDirection:"column",gap:14}}>{items.map((item,i)=>{const done=lc.includes(i);return(<div key={i} style={{display:"flex",alignItems:"center",gap:12,opacity:done?1:0.3,transition:"opacity .4s",padding:"12px 16px",borderRadius:12,background:done?c.oliveLight:"transparent"}}><div style={{width:28,height:28,borderRadius:"50%",background:done?c.olive:`${c.t3}30`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{done?<Check size={14} color={c.white} strokeWidth={2.5}/>:<span style={{width:8,height:8,borderRadius:"50%",background:c.t3,opacity:.5}}/>}</div><div style={{flex:1,minWidth:0}}><div style={{fontSize:14,fontWeight:600,color:c.t1}}>{item}</div><div style={{fontSize:12,color:c.t2}}>{subs[i]}</div></div>{done&&<span style={{fontSize:11,fontWeight:600,color:c.olive,background:c.oliveMed,padding:"2px 10px",borderRadius:5}}>OK</span>}</div>);})}</div><button onClick={()=>setStep(1)} style={{marginTop:32,background:"none",border:"none",cursor:"pointer",fontSize:13,color:c.t3,fontFamily:f,display:"inline-flex",alignItems:"center",gap:6}}><ChevronLeft size={15}/>Prekliči in nazaj</button></div><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>);}

  return(<div style={{background:c.ivory,minHeight:"100vh",fontFamily:f}}><div style={{borderBottom:`1px solid ${c.border}`,background:c.white,padding:"16px 24px",display:"flex",alignItems:"center",gap:12,position:"sticky",top:0,zIndex:10}}><button onClick={()=>setStep(s=>s===3?1:Math.max(s-1,1))} style={{background:"none",border:"none",cursor:"pointer",padding:4}}><ChevronLeft size={20} color={c.t2}/></button><div style={{flex:1}}><div style={{fontSize:13,color:c.t2}}>Korak {step-2} od 4</div><div style={{fontSize:15,fontWeight:600,color:c.t1}}>{step===3?"Profil podjetja":step===4?"KMU klasifikacija":step===5?"Strateški interesi":"Rezultati"}</div></div><div style={{display:"flex",gap:6}}>{[3,4,5,6].map(s=><div key={s} style={{width:s===step?24:8,height:8,borderRadius:4,background:s<=step?c.olive:`${c.t3}30`}}/>)}</div></div><div style={{maxWidth:540,margin:"0 auto",padding:"28px 24px 60px"}}>
    {step===3&&!co&&jodpResult!=null&&!jodpResult.company_in_jodp&&<div style={{textAlign:"center",padding:"48px 24px"}}><div style={{width:56,height:56,borderRadius:16,background:c.amberLight,display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:16}}><X size={24} color={c.amber}/></div><h2 style={{fontSize:20,fontWeight:700,color:c.t1,marginBottom:8}}>{jodpResult.is_davcna?"Davčna številka ni podprta":"Podjetja nismo našli"}</h2><p style={{fontSize:14,color:c.t2,marginBottom:8}}>{jodpResult.is_davcna?<>Številka <strong>{iv}</strong> je davčna številka — JODP evidenca zahteva <strong>matično številko</strong> (10 mest).</>:<>Številka <strong>{iv}</strong> ne obstaja v JODP evidenci.</>}</p><p style={{fontSize:13,color:c.t3,marginBottom:28}}>{jodpResult.is_davcna?"Matično številko podjetja najdete na AJPES portalu ali na poslovnem dokumentu.":"Preverite, ali ste vpisali pravilno matično (10 mest) ali davčno številko (8 mest)."}</p><button onClick={()=>setStep(1)} style={{display:"inline-flex",alignItems:"center",gap:8,padding:"12px 28px",borderRadius:12,border:"none",background:c.graphite,color:c.white,fontSize:14,fontWeight:600,fontFamily:f,cursor:"pointer"}}><ChevronLeft size={16}/>Vpiši drugo številko</button></div>}
    {step===3&&(co||!jodpResult||jodpResult.company_in_jodp)&&<><h2 style={{fontSize:22,fontWeight:700,color:c.t1,marginBottom:24}}>Profil podjetja</h2><div style={{background:c.white,border:`1px solid ${c.border}`,borderRadius:16,padding:"20px 22px",marginBottom:16}}>{[["Firma",mc.name],["Matična",mc.maticna],["Davčna",mc.taxNumber],["Naslov",mc.address],["Regija",mc.nuts&&mc.nuts!=="—"?`${mc.region} (${mc.nuts})`:mc.region],["Pravna oblika",mc.legalForm],["Ustanovljeno",`${mc.founded} — ${mc.age} let`],["SKD (glavna)",`${mc.skdMain} — ${mc.skdMainLabel}`]].map(([l,v])=>(<div key={l} style={{display:"flex",alignItems:"baseline",gap:8,padding:"9px 0",borderBottom:`1px solid ${c.border}20`,fontSize:13}}><span style={{color:c.t3,minWidth:100}}>{l}</span><span style={{color:c.t1,fontWeight:500,flex:1}}>{v}</span></div>))}</div><div style={{background:c.white,border:`1px solid ${c.olive}30`,borderLeft:`4px solid ${c.olive}`,borderRadius:16,padding:"20px 22px",marginBottom:24}}><div style={{fontSize:11,fontWeight:700,color:c.olive,marginBottom:14}}>DE MINIMIS STANJE</div><div style={{display:"flex",gap:12,marginBottom:16}}>{[["Prejeto",dmReceived.toLocaleString("sl-SI")+" €",c.t1],["Meja","300.000 €",c.t2],["Prosto",dmFree.toLocaleString("sl-SI")+" €",c.olive]].map(([l,v,col])=>(<div key={l} style={{flex:1,textAlign:"center",padding:"12px 8px",background:c.oliveLight,borderRadius:10}}><div style={{fontSize:11,color:c.t3,marginBottom:4}}>{l}</div><div style={{fontSize:17,fontWeight:700,color:col}}>{v}</div></div>))}</div>{dmRecs.length===0?<div style={{fontSize:12,color:c.t3,padding:"6px 0"}}>Ni evidentiranih de minimis pomoči.</div>:dmRecs.map((r,i)=>(<div key={i} style={{display:"flex",gap:8,fontSize:12,padding:"6px 0"}}><span style={{color:c.t3,minWidth:36}}>{r.date_awarded?r.date_awarded.substring(0,4):r.year}</span><span style={{color:c.t2,flex:1}}>{r.source}</span><span style={{fontWeight:600,color:c.t1}}>{Number(r.amount).toLocaleString("sl-SI")} €</span></div>))}</div><button onClick={()=>setStep(4)} style={btn}>Podatki so pravilni <ArrowRight size={18}/></button></>}
    {step===4&&<><h2 style={{fontSize:22,fontWeight:700,color:c.t1,marginBottom:24}}>KMU klasifikacija</h2>{[{l:"Zaposleni",v:emp,s:setEmp,u:""},{l:"Prihodek",v:rev,s:setRev,u:"M €"},{l:"Bilanca",v:bal,s:setBal,u:"M €"}].map(fi=>(<div key={fi.l} style={{marginBottom:14}}><label style={{fontSize:12,fontWeight:600,color:c.t2,display:"block",marginBottom:6}}>{fi.l}</label><div style={{display:"flex",gap:8}}><input value={fi.v} onChange={e=>fi.s(e.target.value)} style={{flex:1,height:48,border:`1px solid ${c.border}`,borderRadius:12,padding:"0 16px",fontSize:16,fontFamily:f,color:c.t1,background:c.white,outline:"none"}}/>{fi.u&&<span style={{fontSize:13,color:c.t3,display:"flex",alignItems:"center"}}>{fi.u}</span>}</div></div>))}{(e>0||r>0)&&<div style={{display:"flex",alignItems:"center",gap:14,padding:"16px 18px",borderRadius:14,background:kmuOk?c.oliveLight:c.amberLight,margin:"16px 0"}}><span style={{fontSize:12,fontWeight:700,color:kmuOk?c.olive:c.amber,background:kmuOk?c.oliveMed:c.amberLight,padding:"5px 14px",borderRadius:8}}>{kmu} PODJETJE</span></div>}<button onClick={()=>setStep(5)} style={{...btn,marginTop:16}}>Naprej <ArrowRight size={18}/></button></>}
    {step===5&&<><h2 style={{fontSize:22,fontWeight:700,color:c.t1,marginBottom:8}}>Strateški interesi</h2><div style={{display:"flex",alignItems:"center",gap:6,padding:"8px 12px",borderRadius:10,background:c.signalLight,marginBottom:24}}><Sparkles size={14} color={c.signal}/><span style={{fontSize:12,color:c.signal,fontWeight:500}}>AI priporoča: Digitalizacija, Izvoz</span></div><div style={{display:"flex",flexWrap:"wrap",gap:10,marginBottom:32}}>{intOpts.map(({id,label,Icon})=>{const s=sel.has(id);return(<button key={id} onClick={()=>toggleI(id)} style={{display:"flex",alignItems:"center",gap:8,padding:"12px 20px",borderRadius:12,fontSize:14,fontWeight:500,fontFamily:f,cursor:"pointer",background:s?c.oliveLight:c.white,border:`1.5px solid ${s?c.olive:c.border}`,color:s?c.olive:c.t2}}><Icon size={16}/>{label}</button>);})}</div><button onClick={()=>setStep(6)} style={btn}>Poišči priložnosti <ArrowRight size={18}/></button></>}
    {step===6&&<><div style={{textAlign:"center",marginBottom:28}}><div style={{width:64,height:64,borderRadius:20,background:c.olive,display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:16}}><Sparkles size={28} color={c.white}/></div><h2 style={{fontSize:24,fontWeight:700,color:c.t1}}>Profil pripravljen</h2></div><div style={{display:"flex",alignItems:"center",gap:16,padding:"20px 22px",borderRadius:16,background:c.oliveLight,border:`1px solid ${c.olive}20`,marginBottom:20}}><div style={{fontSize:36,fontWeight:800,color:c.olive}}>7</div><div><div style={{fontSize:16,fontWeight:600,color:c.t1}}>priložnosti</div><div style={{fontSize:13,color:c.t2}}>3 z ujemanjem nad 80 %</div></div></div><button onClick={()=>onComplete(iv)} style={{...btn,height:56,background:c.olive,fontSize:16,fontWeight:700}}>Odpri priložnosti <ArrowRight size={20}/></button></>}
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
  if(loading)return(<div style={{padding:"32px 0",textAlign:"center"}}><Loader2 size={20} color={c.t3} strokeWidth={2} style={{animation:"spin 1s linear infinite"}}/><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>);
  return(<div>
    <div style={{display:"flex",flexDirection:isMobile?"column":"row",gap:12,marginBottom:20}}>
      {[["SKUPAJ EVIDENTIRANIH",fmtA(total),c.t1],["ZADNJA POMOČ",fmtD(lastDate),c.amber],["ŠTEVILO ZAPISOV",String(recs.length),c.olive]].map(([l,v,col])=>(
        <div key={l} style={{flex:1,padding:"16px 18px",borderRadius:12,background:c.ivory,border:`1px solid ${c.border}`}}>
          <div style={{fontSize:10,fontWeight:700,color:c.t3,letterSpacing:".05em",marginBottom:6}}>{l}</div>
          <div style={{fontSize:20,fontWeight:700,color:col}}>{v}</div>
        </div>
      ))}
    </div>
    {recs.length===0?(
      <div style={{padding:"36px 24px",textAlign:"center",color:c.t3,fontSize:13,background:c.ivory,borderRadius:12,border:`1px solid ${c.border}`}}>Ni evidentiranih de minimis pomoči za to podjetje.</div>
    ):(
      isMobile?(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {recs.map((r,i)=>(
            <div key={r.id||i} style={{background:c.ivory,border:`1px solid ${c.border}`,borderRadius:12,padding:"14px 16px"}}>
              <div style={{display:"flex",justifyContent:"space-between",gap:12,marginBottom:8}}>
                <span style={{fontSize:12,color:c.t3}}>{fmtD(r.granted_date)}</span>
                <span style={{fontSize:13,fontWeight:700,color:c.t1}}>{fmtA(Number(r.amount))}</span>
              </div>
              <div style={{fontSize:13,color:c.t1,fontWeight:600,marginBottom:4}}>{r.provider||"—"}</div>
              <div style={{fontSize:12,color:c.t2,lineHeight:1.4}}>{r.programme||"—"}</div>
            </div>
          ))}
        </div>
      ):(
      <div style={{borderRadius:14,border:`1px solid ${c.border}`,overflow:"hidden"}}>
        <div style={{display:"grid",gridTemplateColumns:"120px 1fr 1fr 140px",background:c.ivory,borderBottom:`1px solid ${c.border}`}}>
          {["DATUM","DAJALEC","PROGRAM / PRAVNA OSNOVA","ZNESEK"].map(h=>(
            <div key={h} style={{padding:"10px 14px",fontSize:10,fontWeight:700,letterSpacing:".05em",color:c.t3}}>{h}</div>
          ))}
        </div>
        {recs.map((r,i)=>(
          <div key={r.id||i} style={{display:"grid",gridTemplateColumns:"120px 1fr 1fr 140px",borderTop:`1px solid ${c.border}20`,background:i%2===0?c.white:`${c.ivory}80`}}>
            <div style={{padding:"11px 14px",fontSize:13,color:c.t2}}>{fmtD(r.granted_date)}</div>
            <div style={{padding:"11px 14px",fontSize:13,color:c.t1,fontWeight:500}}>{r.provider||"—"}</div>
            <div style={{padding:"11px 14px",fontSize:13,color:c.t2,lineHeight:1.4}}>{r.programme||"—"}</div>
            <div style={{padding:"11px 14px",fontSize:13,fontWeight:700,color:c.t1,textAlign:"right"}}>{fmtA(Number(r.amount))}</div>
          </div>
        ))}
      </div>)
    )}
  </div>);
}

/* ═══ COMPANY PROFILE ══════════════════════════════ */
function CompanyProfile({maticna}){
  const isMobile=useIsMobile();
  const[company,setCompany]=useState(null);const[loading,setLoading]=useState(true);
  useEffect(()=>{if(!maticna){setLoading(false);return;}let active=true;(async()=>{const{data}=await sb.from("companies").select("*").eq("registration_number",maticna).maybeSingle();if(active){setCompany(data||null);setLoading(false);}})();return()=>{active=false;};},[maticna]);
  const mc={name:company?.company_name||"Podjetje ni najdeno",maticna:company?.registration_number||maticna||"—",taxNumber:company?.tax_number||"—",address:company?.address||"—",region:company?.region||company?.municipality||"—",nuts:company?.nuts||"—",legalForm:company?.legal_form||"—",founded:company?.founded_year||"—",skdMain:company?.main_activity_code||"—",skdMainLabel:company?.main_activity_name||"—"};
  const sh=(Icon,title)=>(<div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,paddingBottom:12,borderBottom:`1px solid ${c.border}`}}><div style={{width:32,height:32,borderRadius:10,background:c.oliveMed,display:"flex",alignItems:"center",justifyContent:"center"}}><Icon size={16} color={c.olive} strokeWidth={1.75}/></div><h2 style={{fontSize:15,fontWeight:700,color:c.t1,margin:0}}>{title}</h2></div>);
  const card={background:c.white,border:`1px solid ${c.border}`,borderRadius:16,padding:isMobile?"18px 16px":"22px 24px",marginBottom:20};
  if(loading)return(<div style={{padding:isMobile?"24px 16px":"48px",fontFamily:f,color:c.t2}}>Nalagam podatke podjetja …</div>);
  return(<div style={{padding:isMobile?"20px 16px 40px":"28px 28px 60px"}}>
    <div style={{marginBottom:24}}>
      <h1 style={{fontSize:isMobile?20:22,fontWeight:700,color:c.t1,marginBottom:4}}>{mc.name}</h1>
      <div style={{fontSize:13,color:c.t2}}>Matična {mc.maticna} · {mc.region} · {mc.legalForm}</div>
    </div>
    <div style={card}>
      {sh(Building2,"Osnovni podatki")}
      <div>{[["Matična",mc.maticna],["Davčna",mc.taxNumber],["Naslov",mc.address],["Regija",mc.nuts&&mc.nuts!=="—"?`${mc.region} (${mc.nuts})`:mc.region],["Pravna oblika",mc.legalForm],["Ustanovljeno",String(mc.founded)],["SKD",`${mc.skdMain} — ${mc.skdMainLabel}`]].map(([l,v])=>(
        <div key={l} style={{display:"flex",flexDirection:isMobile?"column":"row",gap:isMobile?3:12,padding:"9px 0",borderBottom:`1px solid ${c.border}20`,fontSize:13}}>
          <span style={{color:c.t3,minWidth:isMobile?0:110,flexShrink:0}}>{l}</span>
          <span style={{color:c.t1,fontWeight:500}}>{v}</span>
        </div>
      ))}</div>
    </div>
    <div style={card}>
      {sh(Shield,"De minimis pomoči")}
      <DeMinimisSection maticna={maticna}/>
    </div>
    <div style={card}>
      {sh(Sparkles,"Priporočeni razpisi")}
      <div style={{fontSize:13,color:c.t2}}>7 razpisov z ujemanjem nad 60 %.</div>
    </div>
  </div>);
}

const fallbackGrants=[
  {id:"fallback-1",title:"Digitalizacija poslovanja za MSP",funder:"Primer razpisa",status:"open",deadline:"—",amountLabel:"do 75.000 €",fundingType:"nepovratna sredstva",tags:["Digitalizacija","MSP"],icon:"digital",matchScore:72,topMatch:true,cofinancing:"do 60 %",region:"Slovenija",aiSummary:"Primer razpisa za prikaz v primeru, ko baza še ne vrne aktualnih razpisov.",checklist:[{label:"Regija ustreza",p:true},{label:"KMU pogoj",p:true},{label:"De minimis prostor",p:true}]},
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

function mapGrant(row){
  const tags=[...(row.eligible_sectors||[]),...(row.is_de_minimis?["de minimis"]:[])].slice(0,5);
  const title=String(row.title||"Neimenovan razpis");
  const summary=row.plain_language_summary||row.raw_summary||row.requirements||"Podrobnosti so na voljo v uradni dokumentaciji razpisa.";
  const score=60+Math.min(30,tags.length*6)+(row.is_de_minimis?5:0);
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
    amountLabel:formatGrantAmount(row.max_aid_amount),
    fundingType,
    tags:tags.length?tags:["Razpis"],
    icon:tags.join(" ").toLowerCase().includes("digital")?"digital":tags.join(" ").toLowerCase().includes("zeleni")?"green":"grant",
    matchScore:Math.min(95,score),
    topMatch:false,
    cofinancing:row.funding_rate?`${row.funding_rate}%`:"ni navedeno",
    region:(row.eligible_regions||[]).join(", ")||"Slovenija",
    aiSummary:summary,
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

function GrantIcon({type}){
  const Icon=type==="digital"?Cpu:type==="green"?Leaf:FileText;
  return(<div style={{width:44,height:44,borderRadius:12,background:c.cream,display:"flex",alignItems:"center",justifyContent:"center"}}><Icon size={20} color={c.olive} strokeWidth={1.8}/></div>);
}

function Tag({label,variant}){
  const bg=variant==="status"?c.oliveLight:variant==="deadline"?c.amberLight:variant==="quality"?c.signalLight:c.ivory;
  const col=variant==="status"?c.olive:variant==="deadline"?c.amber:variant==="quality"?c.signal:c.t2;
  return(<span style={{fontSize:10,fontWeight:700,color:col,background:bg,border:`1px solid ${c.border}80`,padding:"3px 7px",borderRadius:5,whiteSpace:"nowrap"}}>{label}</span>);
}

function MatchRing({score,size=88}){
  const stroke=8;const r=(size-stroke)/2;const circ=2*Math.PI*r;const off=circ-(score/100)*circ;
  return(<div style={{width:size,height:size,position:"relative",display:"flex",alignItems:"center",justifyContent:"center"}}><svg width={size} height={size} style={{position:"absolute",inset:0,transform:"rotate(-90deg)"}}><circle cx={size/2} cy={size/2} r={r} fill="none" stroke={`${c.t3}25`} strokeWidth={stroke}/><circle cx={size/2} cy={size/2} r={r} fill="none" stroke={score>=80?c.olive:score>=60?c.amber:c.t3} strokeWidth={stroke} strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round"/></svg><div style={{fontSize:22,fontWeight:800,color:c.t1}}>{score}%</div></div>);
}

/* ═══════════════════════════════════════════════════ */
/*  DASHBOARD (compact, with signal bars fix)         */
/* ═══════════════════════════════════════════════════ */
function SignalBars({score}){
  const filled=Math.round((score/100)*5);const col=score>=80?c.olive:score>=60?c.amber:c.t3;
  return(<div style={{display:"flex",alignItems:"flex-end",gap:2,height:20}}>{Array.from({length:5}).map((_,i)=><div key={i} style={{width:4,height:6+i*3,borderRadius:1.5,background:i<filled?col:`${c.t3}25`}}/>)}</div>);
}

function SourceHealthPanel({items,isMobile}){
  if(!items.length)return null;
  const label=source=>source==="evropskasredstva"?"Evropska sredstva":source==="jodp"?"JODP":source==="sps"?"SPS":source;
  return(<div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(auto-fit,minmax(220px,1fr))",gap:10,marginBottom:24}}>
    {items.map(item=>{const ok=(Number(item.failure_count)||0)===0&&!item.last_error;return(
      <div key={item.source} style={{background:c.white,border:`1px solid ${ok?c.olive+"35":c.amber+"55"}`,borderLeft:`4px solid ${ok?c.olive:c.amber}`,borderRadius:12,padding:"14px 16px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,marginBottom:8}}>
          <div style={{fontSize:12,fontWeight:700,color:c.t1}}>{label(item.source)}</div>
          <span style={{fontSize:10,fontWeight:800,color:ok?c.olive:c.amber,background:ok?c.oliveLight:c.amberLight,padding:"3px 8px",borderRadius:6}}>{ok?"OK":"NAPAKA"}</span>
        </div>
        <div style={{fontSize:12,color:c.t2,lineHeight:1.45}}>Zadnji uspeh: <strong style={{color:c.t1,fontWeight:600}}>{formatDateTime(item.last_success)}</strong></div>
        {item.last_error&&<div style={{fontSize:12,color:c.coral,lineHeight:1.45,marginTop:4,wordBreak:"break-word"}}>{item.last_error}</div>}
      </div>
    );})}
  </div>);
}

function Dashboard({maticna}){
  const isMobile=useIsMobile();
  const [grantItems,setGrantItems]=useState(fallbackGrants);const [sel,setSel]=useState(fallbackGrants[0]);const [af,setAf]=useState("Vse");const [showD,setShowD]=useState(true);const [lt,setLt]=useState(true);const [navSel,setNavSel]=useState("Pregled");const[company,setCompany]=useState(null);const[sourceHealth,setSourceHealth]=useState([]);
  useEffect(()=>{let active=true;(async()=>{const today=new Date().toISOString();const{data}=await sb.from("grants").select("*").in("status",["open","upcoming"]).or(`deadline_at.is.null,deadline_at.gte.${today}`).order("deadline_at",{ascending:true,nullsFirst:false}).limit(80);if(!active)return;const verified=(data||[]).filter(row=>/^https?:\/\//i.test(String(row.source_url||"")));const mapped=verified.map(mapGrant);if(mapped.length){setGrantItems(mapped);setSel(mapped[0]);}})();return()=>{active=false;};},[]);
  useEffect(()=>{let active=true;(async()=>{const{data}=await sb.from("data_source_health").select("source,last_success,last_failure,failure_count,last_error,updated_at").order("source");if(active)setSourceHealth(data||[]);})();return()=>{active=false;};},[]);
  useEffect(()=>{if(!maticna)return;let active=true;(async()=>{const{data}=await sb.from("companies").select("company_name").eq("registration_number",maticna).maybeSingle();if(active)setCompany(data||null);})();return()=>{active=false;};},[maticna]);
  useEffect(()=>{const filtered=filterGrants(grantItems,af);if(filtered.length&&!filtered.some(g=>g.id===sel?.id)){setSel(filtered[0]);setShowD(true);}},[af,grantItems,sel?.id]);
  const filteredGrants=filterGrants(grantItems,af);
  const selectedIsTop=filteredGrants[0]?.id===sel?.id;
  const nav=[{icon:LayoutGrid,label:"Pregled"},{icon:FileText,label:"Razpisi"},{icon:Sparkles,label:"Priložnosti zame",badge:7},{icon:User,label:"Moj profil"},{icon:Bell,label:"Opozorila"},{icon:Calendar,label:"Koledar rokov"},{icon:Bot,label:"AI pomočnik"}];
  return(<div style={{display:"flex",flexDirection:isMobile?"column":"row",minHeight:"100vh",height:isMobile?"auto":"100vh",width:"100%",fontFamily:f,background:c.ivory,color:c.t1,overflow:isMobile?"visible":"hidden"}}>
    <aside style={{width:isMobile?"100%":250,minWidth:isMobile?0:250,background:c.graphite,display:"flex",flexDirection:"column",padding:isMobile?"14px 12px":"28px 16px 20px",justifyContent:"space-between",position:isMobile?"sticky":"static",top:0,zIndex:30}}><div><div style={{display:"flex",alignItems:"center",gap:12,paddingLeft:isMobile?4:12,marginBottom:isMobile?12:8}}><div style={{width:38,height:38,borderRadius:10,background:c.olive,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:14,color:c.white}}>AI</div><div><div style={{color:c.white,fontWeight:700,fontSize:16}}>RAZPISI</div><div style={{color:`${c.white}80`,fontSize:11}}>Pametno do sredstev</div></div></div><nav style={{marginTop:isMobile?0:32,display:"flex",flexDirection:isMobile?"row":"column",gap:4,overflowX:isMobile?"auto":"visible",paddingBottom:isMobile?2:0}}>{nav.map(n=>{const a=navSel===n.label;return(<div key={n.label} onClick={()=>setNavSel(n.label)} style={{display:"flex",alignItems:"center",gap:isMobile?8:12,padding:isMobile?"9px 12px":"11px 14px",borderRadius:14,cursor:"pointer",background:a?c.olive:"transparent",flexShrink:0}}><n.icon size={19} strokeWidth={1.75} color={a?c.white:`${c.white}85`}/><span style={{fontSize:14,fontWeight:a?600:450,color:a?c.white:`${c.white}85`,flex:1,whiteSpace:"nowrap"}}>{isMobile&&n.label.length>12?n.label.split(" ")[0]:n.label}</span>{!isMobile&&n.badge&&<span style={{background:a?c.white:c.olive,color:a?c.olive:c.white,fontSize:11,fontWeight:700,borderRadius:8,padding:"2px 8px"}}>{n.badge}</span>}</div>);})}</nav></div>{!isMobile&&<div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px"}}><div style={{width:34,height:34,borderRadius:10,background:c.olive,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:14,color:c.white}}>{(company?.company_name||"P").charAt(0)}</div><div style={{flex:1,minWidth:0}}><div style={{color:c.white,fontSize:13,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{company?.company_name||"Profil podjetja"}</div><div style={{color:`${c.white}55`,fontSize:11}}>Moj profil</div></div></div>}</aside>
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:isMobile?"visible":"hidden"}}>
      <header style={{display:"flex",alignItems:"center",gap:12,padding:isMobile?"12px 16px":"16px 28px",background:c.white,borderBottom:`1px solid ${c.border}`}}><div style={{flex:1,display:"flex",alignItems:"center",gap:10,background:c.ivory,border:`1px solid ${c.border}`,borderRadius:12,padding:"12px 16px",height:48,minWidth:0}}><Search size={18} color={c.t3}/><input placeholder="Išči po razpisih …" style={{border:"none",background:"transparent",outline:"none",fontSize:14,color:c.t1,fontFamily:f,flex:1,minWidth:0}}/></div>{!isMobile&&<div style={{display:"flex",alignItems:"center",gap:10,fontSize:13,color:c.t2}}>Pogovorni jezik<div onClick={()=>setLt(!lt)} style={{width:44,height:24,borderRadius:12,background:lt?c.olive:c.border,position:"relative",cursor:"pointer"}}><div style={{width:18,height:18,borderRadius:"50%",background:c.white,position:"absolute",top:3,left:lt?23:3,transition:"left .2s"}}/></div></div>}<div style={{position:"relative"}}><Bell size={20} color={c.t2}/><span style={{position:"absolute",top:-4,right:-4,width:16,height:16,borderRadius:"50%",background:c.olive,color:c.white,fontSize:9,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>3</span></div></header>
      <div style={{flex:1,display:"flex",flexDirection:isMobile?"column":"row",overflow:isMobile?"visible":"hidden"}}>
        {navSel==="Moj profil"&&<div style={{flex:1,overflowY:isMobile?"visible":"auto"}}><CompanyProfile maticna={maticna}/></div>}
        {navSel!=="Moj profil"&&<div style={{flex:1,overflowY:isMobile?"visible":"auto",padding:isMobile?"18px 16px 28px":"28px 28px 40px"}}>
          <div style={{background:c.white,border:`1px solid ${c.border}`,borderRadius:18,padding:isMobile?"24px 18px":"40px 44px",marginBottom:28}}><h1 style={{fontSize:isMobile?25:32,fontWeight:700,lineHeight:1.12,color:c.t1,maxWidth:580}}>AI prevod birokratskega jezika.<br/><span style={{color:c.olive}}>Prave priložnosti.</span></h1><div style={{display:"flex",flexDirection:isMobile?"column":"row",gap:isMobile?14:32,marginTop:28}}>{[{I:FileText,t:"AI PREVOD",d:"Prevedeni v pogovorni jezik"},{I:Sparkles,t:"PAMETNO UJEMANJE",d:"Glede na vaš profil in cilje"},{I:Bell,t:"PRAVOČASNA OBVESTILA",d:"Nikoli več zamujenih rokov"}].map(b=><div key={b.t} style={{display:"flex",alignItems:"flex-start",gap:12,flex:1}}><div style={{width:40,height:40,borderRadius:10,background:c.cream,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><b.I size={18} strokeWidth={1.75} color={c.t1}/></div><div><div style={{fontSize:11,fontWeight:700,letterSpacing:".04em",color:c.t1,marginBottom:3}}>{b.t}</div><div style={{fontSize:13,color:c.t2,lineHeight:1.4}}>{b.d}</div></div></div>)}</div></div>
          <SourceHealthPanel items={sourceHealth} isMobile={isMobile}/>
          <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",gap:12,marginBottom:16}}><h2 style={{fontSize:22,fontWeight:700}}>Priložnosti za vas</h2><span style={{fontSize:12,color:c.t3}}>{filteredGrants.length} / {grantItems.length} aktualnih</span></div>
          <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:20}}>{grantFilters.map(fi=><button key={fi} onClick={()=>setAf(fi)} style={{padding:"7px 16px",borderRadius:8,border:"none",fontSize:13,fontWeight:af===fi?600:450,fontFamily:f,cursor:"pointer",background:af===fi?c.graphite:"transparent",color:af===fi?c.white:c.t2}}>{fi}</button>)}</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>{filteredGrants.length===0?<div style={{padding:"28px 22px",borderRadius:14,background:c.white,border:`1px solid ${c.border}`,color:c.t2,fontSize:13}}>Za ta filter trenutno ni aktualnih razpisov.</div>:filteredGrants.map(g=>{const isSel=sel?.id===g.id;const isTop=filteredGrants[0]?.id===g.id;return(<div key={g.id} onClick={()=>{setSel(g);setShowD(true);}} style={{display:"grid",gridTemplateColumns:isMobile?"40px 1fr":"48px 1fr auto auto 16px",alignItems:"center",gap:isMobile?12:16,padding:isMobile?"16px 14px":"20px 22px",borderRadius:16,border:`1px solid ${isSel?c.olive:c.border}`,background:isSel?c.oliveLight:c.white,cursor:"pointer"}}><GrantIcon type={g.icon}/><div style={{minWidth:0}}>{isTop&&<span style={{background:c.olive,color:c.white,fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:5,display:"inline-block",marginBottom:4}}>TOP UJEMANJE</span>}<div style={{fontSize:15,fontWeight:600,color:c.t1,lineHeight:1.3,marginBottom:4}}>{g.title}</div><div style={{fontSize:12,color:c.t2,marginBottom:6}}>{g.funder} · {g.sourceName} · preverjeno {g.lastChecked}</div><div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{g.tags.map(t=><Tag key={t} label={t}/>)}<Tag label={g.fundingType.toUpperCase()} variant="quality"/>{g.status==="open"&&<Tag label="ODPRTO" variant="status"/>}{g.status==="upcoming"&&<Tag label="NAPOVEDAN" variant="deadline"/>}{g.deadline!=="brez roka"&&<Tag label={`ROK ${g.deadline}`} variant="deadline"/>}<Tag label={g.qualityLabel} variant="quality"/></div>{isMobile&&<div style={{display:"flex",justifyContent:"space-between",gap:12,marginTop:10,fontSize:12,color:c.t2}}><span>{g.matchScore}% ujemanje</span><strong style={{color:c.t1}}>{g.amountLabel}</strong></div>}</div>{!isMobile&&<div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}><SignalBars score={g.matchScore}/><div><div style={{fontSize:18,fontWeight:700,color:c.t1,lineHeight:1}}>{g.matchScore}%</div><div style={{fontSize:10,color:c.t3}}>ujemanje</div></div></div>}{!isMobile&&<div style={{textAlign:"right",flexShrink:0}}><div style={{fontSize:14,fontWeight:700,color:c.t1}}>{g.amountLabel}</div><div style={{fontSize:11,color:c.t2}}>{g.fundingType}</div></div>}{!isMobile&&<ChevronRight size={16} color={c.t3}/>}</div>);})}</div>
        </div>}
        {navSel!=="Moj profil"&&showD&&sel&&<aside style={{width:isMobile?"100%":420,minWidth:isMobile?0:420,borderLeft:isMobile?"none":`1px solid ${c.border}`,borderTop:isMobile?`1px solid ${c.border}`:"none",background:c.white,overflowY:isMobile?"visible":"auto",padding:isMobile?"22px 16px 36px":"24px 26px 40px"}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:18}}>{selectedIsTop?<span style={{background:c.olive,color:c.white,fontSize:10,fontWeight:700,padding:"4px 12px",borderRadius:6}}>TOP UJEMANJE</span>:<div/>}<div onClick={()=>setShowD(false)} style={{width:32,height:32,borderRadius:8,background:c.ivory,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><X size={16} color={c.t2}/></div></div><h3 style={{fontSize:isMobile?19:21,fontWeight:700,lineHeight:1.25,color:c.t1,marginBottom:6}}>{sel.title}</h3><div style={{fontSize:13,color:c.t2,marginBottom:14}}>{sel.funder}</div><div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:22}}>{sel.tags.map(t=><Tag key={t} label={t}/>)}{sel.status==="open"&&<Tag label="ODPRTO" variant="status"/>}{sel.status==="upcoming"&&<Tag label="NAPOVEDAN" variant="deadline"/>}{sel.deadline!=="brez roka"&&<Tag label={`ROK ${sel.deadline}`} variant="deadline"/>}<Tag label={sel.qualityLabel} variant="quality"/></div><div style={{marginBottom:22}}><div style={{fontSize:11,fontWeight:700,letterSpacing:".04em",color:c.t1,marginBottom:10}}>AI PREVOD BIROKRATSKEGA JEZIKA</div><div style={{background:c.cream,borderRadius:14,padding:"18px 20px",fontSize:14,lineHeight:1.6,color:c.t1,whiteSpace:"pre-line"}}>{sel.aiSummary}</div></div><div style={{marginBottom:22}}><div style={{fontSize:11,fontWeight:700,letterSpacing:".04em",color:c.t1,marginBottom:12}}>OSNOVNE INFORMACIJE</div>{[[Coins,"Višina:",sel.amountLabel.toLowerCase()],[BarChart3,"Sofin.:",sel.cofinancing],[Clock,"Rok:",sel.deadline],[Shield,"Tip:",sel.fundingType],[MapPin,"Regija:",sel.region],[ExternalLink,"Vir:",sel.sourceName],[Clock,"Preverjeno:",sel.lastChecked]].map(([I,l,v])=><div key={l} style={{display:"flex",alignItems:"center",gap:10,fontSize:13,padding:"5px 0"}}><I size={16} color={c.t3}/><span style={{color:c.t2,minWidth:76}}>{l}</span><span style={{fontWeight:600,color:c.t1,wordBreak:"break-word"}}>{v}</span></div>)}</div><div style={{marginBottom:26}}><div style={{fontSize:11,fontWeight:700,letterSpacing:".04em",color:c.t1,marginBottom:14}}>KAKOVOST PODATKOV</div><div style={{display:"flex",flexDirection:isMobile?"column":"row",gap:isMobile?16:24,alignItems:isMobile?"flex-start":"center"}}><MatchRing score={sel.matchScore} size={isMobile?84:100}/><div style={{display:"flex",flexDirection:"column",gap:7}}>{sel.checklist.map(item=><div key={item.label} style={{display:"flex",alignItems:"center",gap:8,fontSize:13}}><Check size={15} strokeWidth={2.5} color={item.p?c.olive:c.t3}/><span style={{color:item.p?c.t1:c.t3}}>{item.label}</span></div>)}</div></div></div><div style={{display:"flex",flexDirection:isMobile?"column":"row",gap:10}}><button onClick={()=>sel.sourceUrl&&window.open(sel.sourceUrl,"_blank","noopener,noreferrer")} disabled={!sel.sourceUrl} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"13px 20px",borderRadius:10,border:"none",background:sel.sourceUrl?c.graphite:c.border,color:c.white,fontSize:13,fontWeight:600,cursor:sel.sourceUrl?"pointer":"not-allowed",fontFamily:f}}>VIR RAZPISA <ExternalLink size={14}/></button><button style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"13px 20px",borderRadius:10,border:`1px solid ${c.t1}`,background:"transparent",color:c.t1,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:f}}>SHRANI <Bookmark size={14}/></button></div></aside>}
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
  const go=p=>{setMode(p);window.scrollTo?.(0,0);};
  if(mode==="landing") return <Landing go={go} onStart={()=>go("onboarding")}/>;
  if(mode==="kako") return <HowItWorks go={go} onStart={()=>go("onboarding")}/>;
  if(mode==="cenik") return <Pricing go={go} onStart={()=>go("onboarding")}/>;
  if(mode==="onboarding") return <Onboarding onComplete={(m)=>{if(m)setMaticna(m);go("dashboard");}} onBack={()=>go("landing")}/>;
  return <Dashboard maticna={maticna}/>;
}
