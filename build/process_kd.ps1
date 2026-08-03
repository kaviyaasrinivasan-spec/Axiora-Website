Add-Type -AssemblyName System.Drawing
$IM=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$LRW=[System.Drawing.Imaging.ImageLockMode]::ReadWrite
$LR=[System.Drawing.Imaging.ImageLockMode]::ReadOnly
$PF=[System.Drawing.Imaging.PixelFormat]::Format32bppArgb
$PX=[System.Drawing.GraphicsUnit]::Pixel
$dir="C:/Users/abcom/AppData/Local/Temp/claude/c--Users-abcom-Desktop-office-Workboosterai-WP/5e76d591-982f-4e41-80d6-ad9501c72cba/scratchpad"

# Whiten neutral (low-saturation) pixels to white. mode 'light' keeps dark text; 'dark' whitens all neutral (removes dark bg + dark text).
function WhitenNeutral($src,$out,$mode,$outH){
  $orig=New-Object System.Drawing.Bitmap $src
  $ow=$orig.Width;$oh=$orig.Height
  $rect=New-Object System.Drawing.Rectangle 0,0,$ow,$oh
  $d=$orig.LockBits($rect,$LRW,$PF);$st=$d.Stride
  $by=New-Object byte[] ($st*$oh)
  [System.Runtime.InteropServices.Marshal]::Copy($d.Scan0,$by,0,$by.Length)
  for($y=0;$y -lt $oh;$y++){$r=$y*$st
    for($x=0;$x -lt $ow;$x++){$i=$r+$x*4
      $b=$by[$i];$g=$by[$i+1];$rr=$by[$i+2]
      $mx=[math]::Max($rr,[math]::Max($g,$b));$mn=[math]::Min($rr,[math]::Min($g,$b));$dd=$mx-$mn
      $isNeutral = $dd -lt 30
      $whiten=$false
      if($mode -eq 'light'){ if($isNeutral -and $mx -gt 120){$whiten=$true} }
      else { if($isNeutral){$whiten=$true} }
      if($whiten){$by[$i]=255;$by[$i+1]=255;$by[$i+2]=255;$by[$i+3]=255}
    }
  }
  [System.Runtime.InteropServices.Marshal]::Copy($by,0,$d.Scan0,$by.Length)
  $orig.UnlockBits($d)
  # trim non-white bbox
  $d2=$orig.LockBits($rect,$LR,$PF);$st2=$d2.Stride
  $by2=New-Object byte[] ($st2*$oh)
  [System.Runtime.InteropServices.Marshal]::Copy($d2.Scan0,$by2,0,$by2.Length);$orig.UnlockBits($d2)
  $minX=$ow;$minY=$oh;$maxX=0;$maxY=0
  for($y=0;$y -lt $oh;$y++){$r=$y*$st2
    for($x=0;$x -lt $ow;$x++){$i=$r+$x*4
      if($by2[$i] -lt 244 -or $by2[$i+1] -lt 244 -or $by2[$i+2] -lt 244){
        if($x -lt $minX){$minX=$x};if($x -gt $maxX){$maxX=$x};if($y -lt $minY){$minY=$y};if($y -gt $maxY){$maxY=$y}}}}
  Write-Host "$mode bbox: $minX,$minY..$maxX,$maxY of $ow x $oh"
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
WhitenNeutral "C:/Users/abcom/Desktop/office/Workboosterai_WP/source/client_logo/ChatGPT Image Jul 28, 2026, 02_05_12 PM.png" "$dir/kss_new.png" 'light' 240
WhitenNeutral "C:/Users/abcom/Desktop/office/Workboosterai_WP/source/client_logo/ChatGPT Image Jul 28, 2026, 02_08_10 PM.png" "$dir/dhi_new.png" 'dark' 240
Write-Host DONE
