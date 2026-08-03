<?php
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
