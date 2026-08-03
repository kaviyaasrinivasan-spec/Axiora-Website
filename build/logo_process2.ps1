Add-Type -AssemblyName System.Drawing
$src = "C:/Users/abcom/Desktop/office/Workboosterai_WP/source/logo/Final Logo Design (16).png"
$orig = New-Object System.Drawing.Bitmap $src
$ow=$orig.Width; $oh=$orig.Height
$IM=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$LR=[System.Drawing.Imaging.ImageLockMode]::ReadOnly
$LRW=[System.Drawing.Imaging.ImageLockMode]::ReadWrite
$PF=[System.Drawing.Imaging.PixelFormat]::Format32bppArgb
$PX=[System.Drawing.GraphicsUnit]::Pixel

# ---- scan a 2000px-wide copy ----
$sw=2000; $sh=[int][math]::Round($oh*$sw/$ow)
$small=New-Object System.Drawing.Bitmap $sw,$sh
$g=[System.Drawing.Graphics]::FromImage($small); $g.InterpolationMode=$IM
$g.Clear([System.Drawing.Color]::Transparent); $g.DrawImage($orig,0,0,$sw,$sh); $g.Dispose()
$rect=New-Object System.Drawing.Rectangle 0,0,$sw,$sh
$d=$small.LockBits($rect,$LR,$PF); $st=$d.Stride
$by=New-Object byte[] ($st*$sh)
[System.Runtime.InteropServices.Marshal]::Copy($d.Scan0,$by,0,$by.Length); $small.UnlockBits($d)

$minX=$sw;$minY=$sh;$maxX=0;$maxY=0
for($y=0;$y -lt $sh;$y++){$r=$y*$st;for($x=0;$x -lt $sw;$x++){if($by[$r+$x*4+3] -gt 20){if($x -lt $minX){$minX=$x};if($x -gt $maxX){$maxX=$x};if($y -lt $minY){$minY=$y};if($y -gt $maxY){$maxY=$y}}}}
Write-Host "full bbox small: $minX,$minY .. $maxX,$maxY"

# row content in text region (right of icon)
$txtX0=[int]($sw*0.24)
$rowc=New-Object int[] $sh
for($y=0;$y -lt $sh;$y++){$r=$y*$st;$c=0;for($x=$txtX0;$x -lt $sw;$x++){if($by[$r+$x*4+3] -gt 20){$c++}};$rowc[$y]=$c}
$thresh=4; $y=$minY
while($y -le $maxY -and $rowc[$y] -lt $thresh){$y++}
while($y -le $maxY -and $rowc[$y] -ge $thresh){$y++}
$gapStart=$y
Write-Host "wordmark band ends at small y=$gapStart (tagline erased below this in text region)"

$sc=$ow/$sw
$eraseY=[int]($gapStart*$sc); $eraseX=[int]($txtX0*$sc)

# ---- erase tagline+divider on the original (alpha=0 for y>=eraseY, x>=eraseX) ----
$rectO=New-Object System.Drawing.Rectangle 0,0,$ow,$oh
$do=$orig.LockBits($rectO,$LRW,$PF); $sto=$do.Stride
$rowbuf=New-Object byte[] $sto
for($y=$eraseY;$y -lt $oh;$y++){
  $ptr=[System.IntPtr]::Add($do.Scan0,$y*$sto)
  [System.Runtime.InteropServices.Marshal]::Copy($ptr,$rowbuf,0,$sto)
  for($x=$eraseX;$x -lt $ow;$x++){$rowbuf[$x*4+3]=0}
  [System.Runtime.InteropServices.Marshal]::Copy($rowbuf,0,$ptr,$sto)
}
$orig.UnlockBits($do)

# ---- crop to icon+wordmark bbox, high-res height 400 ----
$fx=[int]($minX*$sc);$fy=[int]($minY*$sc);$fw=[int](($maxX-$minX+1)*$sc);$fh=[int](($maxY-$minY+1)*$sc)
$pad=[int]($fh*0.05)
$fx=[math]::Max(0,$fx-$pad);$fy=[math]::Max(0,$fy-$pad)
$fw=[math]::Min($ow-$fx,$fw+2*$pad);$fh=[math]::Min($oh-$fy,$fh+2*$pad)
$outH=400; $outW=[int][math]::Round($fw*$outH/$fh)
$logo=New-Object System.Drawing.Bitmap $outW,$outH
$g2=[System.Drawing.Graphics]::FromImage($logo)
$g2.InterpolationMode=$IM; $g2.PixelOffsetMode=[System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g2.Clear([System.Drawing.Color]::Transparent)
$g2.DrawImage($orig,(New-Object System.Drawing.Rectangle 0,0,$outW,$outH),(New-Object System.Drawing.Rectangle $fx,$fy,$fw,$fh),$PX)
$g2.Dispose()
$out="C:/Users/abcom/AppData/Local/Temp/claude/c--Users-abcom-Desktop-office-Workboosterai-WP/5e76d591-982f-4e41-80d6-ad9501c72cba/scratchpad/axiora-wordmark.png"
$logo.Save($out,[System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "wordmark logo: $outW x $outH -> $out"
$orig.Dispose();$small.Dispose();$logo.Dispose()
Write-Host "DONE"
