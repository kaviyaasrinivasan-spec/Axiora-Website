Add-Type -AssemblyName System.Drawing
$IM=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$src="C:/Users/abcom/Desktop/office/Workboosterai_WP/source/Hero_imgs"
$out="C:/Users/abcom/AppData/Local/Temp/claude/c--Users-abcom-Desktop-office-Workboosterai-WP/5e76d591-982f-4e41-80d6-ad9501c72cba/scratchpad"
$enc=[System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object {$_.MimeType -eq 'image/jpeg'}
function QP($q){ $p=New-Object System.Drawing.Imaging.EncoderParameters 1; $p.Param[0]=New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality),([long]$q); return $p }
$map=@{ "Cargora_hero.png"="hero-logi"; "Trackcontainer_hero.jpeg"="hero-track"; "Iclinical_hero.jpeg"="hero-iclin"; "Meetingclosure_hero.jpeg"="hero-meet" }
function Make($w,$q,$suffix){
  foreach($k in $map.Keys){
    $o=New-Object System.Drawing.Bitmap (Join-Path $src $k)
    $W=$w; if($W -gt $o.Width){$W=$o.Width}
    $H=[int][math]::Round($o.Height*$W/$o.Width)
    $b=New-Object System.Drawing.Bitmap $W,$H
    $g=[System.Drawing.Graphics]::FromImage($b); $g.InterpolationMode=$IM; $g.PixelOffsetMode=[System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality; $g.SmoothingMode=[System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.DrawImage($o,0,0,$W,$H); $g.Dispose()
    $dest=Join-Path $out ($map[$k]+$suffix+".jpg")
    $b.Save($dest,$enc,(QP $q))
    "{0} : {1}x{2} q{3} {4}KB" -f ($map[$k]+$suffix),$W,$H,$q,([int]((Get-Item $dest).Length/1024))
    $o.Dispose(); $b.Dispose()
  }
}
Write-Host "== FULL (theme) =="; Make 1536 92 ""
Write-Host "== PREVIEW base64 =="; Make 1440 85 "-pv"