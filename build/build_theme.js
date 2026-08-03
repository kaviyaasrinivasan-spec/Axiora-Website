const fs=require("fs"), path=require("path");
const SRC=__dirname;
const OUT="C:/Users/abcom/Desktop/office/Workboosterai_WP/axioralabs_wp";
const sol=require("./gen_solutions.js");

function rd(f){return fs.readFileSync(path.join(SRC,f),"utf8");}
function mkdirp(d){fs.mkdirSync(d,{recursive:true});}
function wr(rel,content){const p=path.join(OUT,rel);mkdirp(path.dirname(p));fs.writeFileSync(p,content);}

// ---------- read sources ----------
const home=rd("home_v2.html");
const audit=rd("automation_opportunities.html");

function between(s,a,b,inclusive){const i=s.indexOf(a);const j=s.indexOf(b,i+a.length);return inclusive?s.slice(i,j+b.length):s.slice(i+a.length,j);}

// base style (home <style>)
let baseCss=between(home,"<style>","</style>",false);
baseCss=baseCss.replace(/data:font\/woff2;base64,__OUTFIT__/g,"../fonts/outfit.woff2").replace(/data:font\/woff2;base64,__INTER__/g,"../fonts/inter.woff2");

// main js (home <script>)
const mainJs=between(home,"<script>","</script>",false);

// chrome chunks
const topbarStart=home.indexOf("<!-- ===== TOP BAR ===== -->");
const mainStart=home.indexOf('<main id="top">');
const mainEnd=home.indexOf("</main>")+7;
const footerStart=home.indexOf("<footer");
const footerEnd=home.indexOf("</footer>")+9;
let headerChunk=home.slice(topbarStart,mainStart);
let homeMain=home.slice(mainStart,mainEnd);
let footerChunk=home.slice(footerStart,footerEnd);

// ---------- merged icon sprite ----------
function symbolsFrom(str){const out={};const re=/<symbol[\s\S]*?<\/symbol>/g;let m;while((m=re.exec(str))){const id=(m[0].match(/id="([^"]+)"/)||[])[1];if(id&&!out[id])out[id]=m[0];}return out;}
const homeSprite=between(home,'<svg width="0"',"</svg>",true);
const buildPageSrc=rd("build_page.js");
const auditSprite=between(audit,'<svg width="0"',"</svg>",true);
let syms={};
[symbolsFrom(homeSprite),symbolsFrom(buildPageSrc),symbolsFrom(sol.EXTRA_SYMBOLS),symbolsFrom(auditSprite)].forEach(o=>{for(const k in o)if(!syms[k])syms[k]=o[k];});
const spriteMerged='<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>\n'+Object.values(syms).join("\n")+'\n</defs></svg>';

// ---------- link + image conversion ----------
const IMG="<?php echo get_template_directory_uri(); ?>/assets/img/";
const URLMAP={
 "5941499c-bbe3-48a8-95c1-3daa052d6065":"/",
 "e6d9bdf9-73eb-4bc7-93d7-c1ff46e480bd":"/about/",
 "8474875c-cbd2-4450-a2bb-33752438bbd1":"/ai-consulting/",
 "4cceb72e-4d06-40b5-ac1f-d06c786de7fc":"/custom-ai-solutions/",
 "c156c83f-4fbd-4e14-b42a-deea32b41d67":"/ai-product-engineering/",
 "349c2b5d-c795-4189-ac06-7d2dcbcbd0c6":"/dedicated-ai-engineering/",
 "2252caef-2d46-4d75-8cd8-8e3c43f46bd9":"/industries/",
 "0c1b47ba-5c67-4ab8-aafa-a2d5aa275f3d":"/cargora/",
 "d12bb194-bb5a-447a-94be-4cf90c4c0964":"/contact/",
 "2094eba2-4807-4d0a-bef2-a806c146ebe3":"/careers/",
 "c60469e2-f2da-42f4-8055-c461563a73e4":"/privacy-policy/",
 "94d4765e-8f61-451e-a0d6-a9cf1a0b95e6":"/terms-and-conditions/",
 "29d213c5-45f1-4078-b960-7cef6a5c5f69":"/automation-opportunities/",
 "05182acf-130a-4db7-a73e-507785b6cc86":"/logistics-supply-chain/",
 "e7d9f2b9-f430-4332-82ad-efc393c4998c":"/pharma-life-sciences/",
 "96318481-8c00-4df0-a1f0-9eb6187efa57":"/enterprise-it/",
 "075ec235-51d0-4493-886e-9c12391e9608":"/manufacturing-industry/",
 "66ca8b7e-cfd5-47e6-8437-222ea96d276f":"/banking-financial-services/",
 "1c737815-ee38-4f5e-a9a4-3fc48dc30ef4":"/insurance-industry/",
 "37f97988-1577-4500-bee7-bdb71eb9c05e":"/healthcare/",
 "8268ac48-8bd0-440f-b29a-f5b37f4a2217":"/legal-services/",
 "2b85d5bc-0f27-483d-ac18-b92d5031d4ec":"/government-public-sector/"
};
const ANCHOR={contact:"/contact/",platform:"/cargora/",industries:"/industries/",solutions:"/ai-consulting/",story:"/about/","privacy":"/privacy-policy/","terms":"/terms-and-conditions/",top:"/"};
function convLinks(h){
  for(const id in URLMAP){h=h.split("https://claude.ai/code/artifact/"+id).join(URLMAP[id]);}
  h=h.replace(/href="#([a-zA-Z-]+)"/g,(m,f)=>ANCHOR[f]?`href="${ANCHOR[f]}"`:m);
  return h;
}
function convImg(h){
  return h
   .split("data:image/png;base64,__LOGOT__").join(IMG+"logo.png")
   .split("data:image/png;base64,__KSS__").join(IMG+"kss.png")
   .split("data:image/png;base64,__DHI__").join(IMG+"dhi.png")
   .split("data:image/png;base64,__FOURS__").join(IMG+"4s.png")
   .split("data:image/png;base64,__CLIENT4__").join(IMG+"client4.png")
   .split("data:image/jpeg;base64,__FOUNDER__").join(IMG+"founder.jpg")
   .split("data:image/jpeg;base64,__TEAM__").join(IMG+"team.jpg")
   .split("data:image/jpeg;base64,__HEROLOGI__").join(IMG+"hero-logi.jpg")
   .split("data:image/jpeg;base64,__HEROTRACK__").join(IMG+"hero-track.jpg")
   .split("data:image/jpeg;base64,__HEROICLIN__").join(IMG+"hero-iclin.jpg")
   .split("data:image/jpeg;base64,__HEROMEET__").join(IMG+"hero-meet.jpg");
}
const conv=h=>convImg(convLinks(h));

headerChunk=conv(headerChunk); footerChunk=conv(footerChunk); homeMain=conv(homeMain);

// ---------- write CSS ----------
wr("assets/css/base.css",baseCss);
wr("assets/css/our-story.css",rd("our_story.css"));
wr("assets/css/industries.css",rd("industries.css"));
wr("assets/css/platforms.css",rd("platforms.css"));
wr("assets/css/contact.css",rd("contact.css"));
wr("assets/css/careers.css",rd("careers.css"));
wr("assets/css/legal.css",rd("legal.css"));
wr("assets/css/solutions.css",sol.CSS);
wr("assets/css/industry.css",rd("industry.css"));

// audit css: self-contained (its <style>, fonts->file)
let auditCss=between(audit,"<style>","</style>",false).replace(/data:font\/woff2;base64,__OUTFIT__/g,"../fonts/outfit.woff2").replace(/data:font\/woff2;base64,__INTER__/g,"../fonts/inter.woff2");
wr("assets/css/audit.css",auditCss);

// ---------- JS ----------
wr("assets/js/main.js",mainJs);

// ---------- copy assets ----------
const cp=(from,to)=>{mkdirp(path.dirname(path.join(OUT,to)));fs.copyFileSync(path.join(SRC,from),path.join(OUT,to));};
cp("inter.woff2","assets/fonts/inter.woff2");
cp("outfit.woff2","assets/fonts/outfit.woff2");
cp("axiora-logo.png","assets/img/logo.png");
cp("axiora-fav.png","assets/img/favicon.png");
cp("iddcr_new.png","assets/img/client4.png");
cp("kss_new.png","assets/img/kss.png");
cp("dhi_new.png","assets/img/dhi.png");
cp("4s_logo.png","assets/img/4s.png");
cp("founder.jpg","assets/img/founder.jpg");
cp("team.jpg","assets/img/team.jpg");
cp("hero-logi.jpg","assets/img/hero-logi.jpg");
cp("hero-track.jpg","assets/img/hero-track.jpg");
cp("hero-iclin.jpg","assets/img/hero-iclin.jpg");
cp("hero-meet.jpg","assets/img/hero-meet.jpg");

// ---------- PHP: style.css ----------
wr("style.css",`/*
Theme Name: Axiora Labs
Theme URI: https://axioralabs.ai
Author: Axiora Labs
Description: Custom enterprise theme for Axiora Labs — AI automation. Built to match the approved design.
Version: 1.2.1
*/
`);

// ---------- functions.php ----------
wr("functions.php",`<?php
if(!defined('ABSPATH'))exit;
function wb_assets(){
  $u=get_template_directory_uri(); $v='1.2.1';
  if(is_page_template('template-audit.php')){
    wp_enqueue_style('wb-audit',$u.'/assets/css/audit.css',array(),$v);
    return;
  }
  wp_enqueue_style('wb-base',$u.'/assets/css/base.css',array(),$v);
  wp_enqueue_script('wb-main',$u.'/assets/js/main.js',array(),$v,true);
  $map=array(
    'template-about.php'=>'our-story.css',
    'template-industries.php'=>'industries.css',
    'template-platforms.php'=>'platforms.css',
    'template-contact.php'=>'contact.css',
    'template-careers.php'=>'careers.css',
    'template-privacy.php'=>'legal.css',
    'template-terms.php'=>'legal.css',
    'template-sol-consulting.php'=>'solutions.css',
    'template-sol-custom.php'=>'solutions.css',
    'template-sol-product.php'=>'solutions.css',
    'template-sol-dedicated.php'=>'solutions.css',
    'template-ind-logistics.php'=>'industry.css',
    'template-ind-pharma.php'=>'industry.css',
    'template-ind-enterprise-it.php'=>'industry.css',
    'template-ind-manufacturing.php'=>'industry.css',
    'template-ind-banking.php'=>'industry.css',
    'template-ind-insurance.php'=>'industry.css',
    'template-ind-healthcare.php'=>'industry.css',
    'template-ind-legal.php'=>'industry.css',
    'template-ind-government.php'=>'industry.css'
  );
  foreach($map as $tpl=>$css){ if(is_page_template($tpl)){ wp_enqueue_style('wb-page',$u.'/assets/css/'.$css,array('wb-base'),$v); } }
}
add_action('wp_enqueue_scripts','wb_assets');
add_theme_support('title-tag');
add_theme_support('post-thumbnails');
add_theme_support('html5',array('style','script'));
`);

// ---------- header.php / footer.php ----------
wr("header.php",`<!doctype html>
<html <?php language_attributes(); ?>>
<head>
<meta charset="<?php bloginfo('charset'); ?>">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="icon" href="<?php echo get_template_directory_uri(); ?>/assets/img/favicon.png" type="image/png">
<link rel="apple-touch-icon" href="<?php echo get_template_directory_uri(); ?>/assets/img/favicon.png">
<?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
${spriteMerged}
${headerChunk}
`);

wr("footer.php",`${footerChunk}
<?php wp_footer(); ?>
</body>
</html>
`);

// ---------- index.php (fallback) ----------
wr("index.php",`<?php get_header(); ?>
<main id="top"><section class="section"><div class="wrap" style="text-align:center;padding:80px 0"><h1>Page not found</h1><p style="margin-top:12px"><a class="btn btn-primary" href="/">Go Home</a></p></div></section></main>
<?php get_footer(); ?>
`);

// ---------- front-page.php (home) ----------
wr("front-page.php",`<?php get_header(); ?>
${homeMain}
<?php get_footer(); ?>
`);

// ---------- page templates ----------
function tpl(file,name,mainHtml){
  wr(file,`<?php /* Template Name: ${name} */ get_header(); ?>
${conv(mainHtml)}
<?php get_footer(); ?>
`);
}
tpl("template-about.php","WB — Our Story",rd("our_story_main.html"));
tpl("template-industries.php","WB — Industries",rd("industries_main.html"));
tpl("template-platforms.php","WB — Cargora Platform",rd("platforms_main.html"));
tpl("template-contact.php","WB — Contact",rd("contact_main.html"));
tpl("template-careers.php","WB — Careers",rd("careers_main.html"));
tpl("template-privacy.php","WB — Privacy Policy",rd("privacy_main.html"));
tpl("template-terms.php","WB — Terms & Conditions",rd("terms_main.html"));

// solutions (from module)
const solMap={"ai-consulting":"template-sol-consulting.php","custom-ai-solutions":"template-sol-custom.php","ai-product-engineering":"template-sol-product.php","dedicated-ai-engineering":"template-sol-dedicated.php"};
const solName={"ai-consulting":"WB — AI Consulting","custom-ai-solutions":"WB — Custom AI Solutions","ai-product-engineering":"WB — AI Product Engineering","dedicated-ai-engineering":"WB — Dedicated AI Engineering"};
for(const p of sol.pages){ tpl(solMap[p.slug],solName[p.slug],sol.buildMain(p)); }

// industry detail pages
const indPages=[
 ["logistics_main.html","template-ind-logistics.php","Axiora — Logistics & Supply Chain"],
 ["pharma_main.html","template-ind-pharma.php","Axiora — Pharma & Life Sciences"],
 ["enterprise_it_main.html","template-ind-enterprise-it.php","Axiora — Enterprise IT & GCCs"],
 ["manufacturing_main.html","template-ind-manufacturing.php","Axiora — Manufacturing"],
 ["banking_main.html","template-ind-banking.php","Axiora — Banking & Financial Services"],
 ["insurance_main.html","template-ind-insurance.php","Axiora — Insurance"],
 ["healthcare_main.html","template-ind-healthcare.php","Axiora — Healthcare"],
 ["legal_main.html","template-ind-legal.php","Axiora — Legal Services"],
 ["government_main.html","template-ind-government.php","Axiora — Government & Public Sector"]
];
for(const [mf,tf,nm] of indPages){ tpl(tf,nm,rd(mf)); }

// ---------- audit landing (self-contained template) ----------
let auditBody=audit.slice(audit.indexOf("</svg>")+6); // header + land + wa + script
auditBody=conv(auditBody);
wr("template-audit.php",`<?php /* Template Name: WB — Automation Audit (Landing) */ ?>
<!doctype html>
<html <?php language_attributes(); ?>>
<head>
<meta charset="<?php bloginfo('charset'); ?>">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
${spriteMerged}
${auditBody}
<?php wp_footer(); ?>
</body>
</html>
`);

console.log("THEME BUILT at",OUT);
console.log("files:",fs.readdirSync(OUT).join(", "));
