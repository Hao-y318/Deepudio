// 装饰性背景 —— emoji

export function BackgroundDecor() {
  return (
    <div class="bg-decor" aria-hidden="true">
      {/* 左侧播放器 */}
      <span style="position:absolute;bottom:-10px;left:-10px;font-size:140px;opacity:0.13;user-select:none;">🌹</span>

      {/* 中间歌词区 */}
      <span style="position:absolute;top:60px;left:42%;font-size:100px;opacity:0.10;user-select:none;">🌹</span>
      <span style="position:absolute;top:30%;left:55%;font-size:36px;opacity:0.10;user-select:none;">♥</span>
      <span style="position:absolute;bottom:15%;left:40%;font-size:42px;opacity:0.11;user-select:none;">♥</span>
      <span style="position:absolute;top:20%;left:36%;font-size:32px;opacity:0.09;user-select:none;">🌸</span>

      {/* 右侧聊天区 */}
      <span style="position:absolute;top:70px;right:-20px;font-size:110px;opacity:0.10;user-select:none;">🌹</span>
      <span style="position:absolute;top:12%;right:18%;font-size:50px;opacity:0.11;user-select:none;">♥</span>
      <span style="position:absolute;top:38%;left:4%;font-size:36px;opacity:0.10;user-select:none;">♥</span>
      <span style="position:absolute;bottom:28%;right:6%;font-size:44px;opacity:0.12;user-select:none;">♥</span>
      <span style="position:absolute;top:55%;right:22%;font-size:30px;opacity:0.10;user-select:none;">♥</span>
      <span style="position:absolute;bottom:8%;left:18%;font-size:40px;opacity:0.11;user-select:none;">♥</span>
      <span style="position:absolute;top:25%;right:28%;font-size:34px;opacity:0.09;user-select:none;">💕</span>
      <span style="position:absolute;bottom:20%;left:8%;font-size:38px;opacity:0.09;user-select:none;">🌸</span>
      <span style="position:absolute;top:60%;left:14%;font-size:26px;opacity:0.08;user-select:none;">✿</span>
    </div>
  );
}
