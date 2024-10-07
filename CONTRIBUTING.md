# CONTRIBUTING

## 動画gifの作成方法

QuickTimeムービー(.mov)からは、ffmpegを使ってgifを作成します。

```bash
ffmpeg -i input.mov -vf "fps=15,scale=1080:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse=dither=sierra2_4a" -loop 0 output.gif
```
