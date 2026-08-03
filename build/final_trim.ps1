Add-Type -AssemblyName System.Drawing
$IM=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$LR=[System.Drawing.Imaging.ImageLockMode]::ReadOnly
$PF=[System.Drawing.Imaging.PixelFormat]::Format32bppArgb
$PX=[System.Drawing.GraphicsUnit]::Pixel
function Trim($f,$outH){
  $o=New-Object System.Drawing.Bitmap $f;$ow=$o.Width;$oh=$o.Height
  $rect=New-Object System.Drawing.Rectangle 0,0,$ow,$oh
  $d=$o.LockBits($rect,$LR,$PF);$st=$d.Stride;$by=New-Object byte[] ($st*$oh)
  [System.Runtime.InteropServices.Marshal]::Copy($d.Scan0,$by,0,$by.Length);$o.UnlockBits($d)
  $minX=$ow;$minY=$oh;$maxX=0;$maxY=0
  for($y=0;$y -lt $oh;$y++){$r=$y*$st
    for($x=0;$x -lt $ow;$x++){$i=$r+$x*4
      $mn=[math]::Min($by[$i+2],[math]::Min($by[$i+1],$by[$i]))
      if($mn -lt 240){if($x -lt $minX){$minX=$x};if($x -gt $maxX){$maxX=$x};if($y -lt $minY){$minY=$y};if($y -gt $maxY){$maxY=$y}}}}
  Write-Host "$f tight bbox: $minX,$minY..$maxX,$maxY of $ow x $oh"
  $pad=[int](($maxY-$minY)*0.10)
  $cx=[math]::Max(0,$minX-$pad);$cy=[math]::Max(0,$minY-$pad)
  $cw=[math]::Min($ow-$cx,($maxX-$minX+1)+2*$pad);$ch=[math]::Min($oh-$cy,($maxY-$minY+1)+2*$pad)
  $outW=[int][math]::Round($cw*$outH/$ch)
  $b=New-Object System.Drawing.Bitmap $outW,$outH
  $g=[System.Drawing.Graphics]::FromImage($b);$g.InterpolationMode=$IM;$g.PixelOffsetMode=[System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear([System.Drawing.Color]::White)
  $g.DrawImage($o,(New-Object System.Drawing.Rectangle 0,0,$outW,$outH),(New-Object System.Drawing.Rectangle $cx,$cy,$cw,$ch),$PX);$g.Dispose()
  $o.Dispose();$b.Save($f,[System.Drawing.Imaging.ImageFormat]::Png);$b.Dispose()
  Write-Host "  -> $outW x $outH"
}
$d="C:/Users/abcom/AppData/Local/Temp/claude/c--Users-abcom-Desktop-office-Workboosterai-WP/5e76d591-982f-4e41-80d6-ad9501c72cba/scratchpad"
Trim "$d/kss_new.png" 220
Trim "$d/dhi_new.png" 220
Write-Host DONE
