Add-Type -AssemblyName System.Drawing
$IM=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$LR=[System.Drawing.Imaging.ImageLockMode]::ReadOnly
$PF=[System.Drawing.Imaging.PixelFormat]::Format32bppArgb
$PX=[System.Drawing.GraphicsUnit]::Pixel
$dir="C:/Users/abcom/AppData/Local/Temp/claude/c--Users-abcom-Desktop-office-Workboosterai-WP/5e76d591-982f-4e41-80d6-ad9501c72cba/scratchpad"

function TrimResize($src,$out,$outH){
  $orig=New-Object System.Drawing.Bitmap $src
  $ow=$orig.Width; $oh=$orig.Height
  $rect=New-Object System.Drawing.Rectangle 0,0,$ow,$oh
  $d=$orig.LockBits($rect,$LR,$PF); $st=$d.Stride
  $by=New-Object byte[] ($st*$oh)
  [System.Runtime.InteropServices.Marshal]::Copy($d.Scan0,$by,0,$by.Length); $orig.UnlockBits($d)
  # non-white bbox (BGRA); "content" = pixel darker than 244 on any channel AND opaque
  $minX=$ow;$minY=$oh;$maxX=0;$maxY=0
  for($y=0;$y -lt $oh;$y++){$r=$y*$st
    for($x=0;$x -lt $ow;$x++){$i=$r+$x*4
      $b=$by[$i];$g=$by[$i+1];$rr=$by[$i+2];$a=$by[$i+3]
      if($a -gt 30 -and ($b -lt 244 -or $g -lt 244 -or $rr -lt 244)){
        if($x -lt $minX){$minX=$x};if($x -gt $maxX){$maxX=$x};if($y -lt $minY){$minY=$y};if($y -gt $maxY){$maxY=$y}}}}
  Write-Host "$src bbox: $minX,$minY..$maxX,$maxY (of $ow x $oh)"
  $pad=[int](($maxY-$minY)*0.06)
  $cx=[math]::Max(0,$minX-$pad);$cy=[math]::Max(0,$minY-$pad)
  $cw=[math]::Min($ow-$cx,($maxX-$minX+1)+2*$pad);$ch=[math]::Min($oh-$cy,($maxY-$minY+1)+2*$pad)
  $outW=[int][math]::Round($cw*$outH/$ch)
  $bmp=New-Object System.Drawing.Bitmap $outW,$outH
  $g2=[System.Drawing.Graphics]::FromImage($bmp)
  $g2.InterpolationMode=$IM;$g2.PixelOffsetMode=[System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g2.Clear([System.Drawing.Color]::White)
  $g2.DrawImage($orig,(New-Object System.Drawing.Rectangle 0,0,$outW,$outH),(New-Object System.Drawing.Rectangle $cx,$cy,$cw,$ch),$PX)
  $g2.Dispose()
  $bmp.Save($out,[System.Drawing.Imaging.ImageFormat]::Png)
  Write-Host "  -> $out : $outW x $outH"
  $orig.Dispose();$bmp.Dispose()
}

TrimResize "C:/Users/abcom/Desktop/office/Workboosterai_WP/source/client_logo/ChatGPT Image Jul 28, 2026, 01_58_42 PM.png" "$dir/4s_new.png" 240
TrimResize "C:/Users/abcom/Desktop/office/Workboosterai_WP/source/client_logo/ChatGPT Image Jul 28, 2026, 02_11_36 PM.png" "$dir/iddcr_new.png" 240
Write-Host "DONE"
