/* assets/js/p5-visualizer.js */

let mic, fft, isReady = false;
let scrollSpeed = 2; // 滚动速度，越高越快
let res = 5;         // 纵向分辨率，越小越细腻

function setup() {
  let cnv = createCanvas(windowWidth, windowHeight);
  cnv.id('p5-background');
  cnv.parent(document.body);
  
  // 关键：设置 HSB 模式，这是高级感色彩的基础
  colorMode(HSB, 360, 100, 100, 100);
  
  fft = new p5.FFT(0.85, 512);
  
  // 初始化画布为透明黑
  background(0);
}

function draw() {
  if (!isReady) {
    background(10);
    fill(255);
    textAlign(CENTER);
    text("TAP TO START SPECTROGRAM", width/2, height/2);
    return;
  }

  // --- 核心滚动逻辑：直接平移主画布图像 ---
  // 获取当前画布内容并向左拷贝
  let tempImg = get(scrollSpeed, 0, width - scrollSpeed, height);
  
  // 清理并重新铺底（保持透明度）
  clear();
  
  // 把刚才截取的图像贴回去（实现向左移动的效果）
  image(tempImg, 0, 0);

  // --- 在最右侧画出最新的一列频谱 ---
  let spectrum = fft.analyze();
  
  push();
  noStroke();
  let xPos = width - scrollSpeed; // 始终在最右边画
  
  for (let i = 0; i < spectrum.length; i += 3) {
    let amp = spectrum[i];
    if (amp > 10) {
      // 垂直位置映射
      let yPos = map(i, 0, spectrum.length, height, 0);
      
      // 你的原版高级配色：青色到紫色
      let hueVal = map(i, 0, spectrum.length, 180, 280); 
      let brightness = map(amp, 0, 255, 40, 100);
      let alpha = map(amp, 0, 255, 30, 100);
      
      fill(hueVal, 80, brightness, alpha);
      
      // 画矩形块
      rect(xPos, yPos, scrollSpeed + 1, res);
    }
  }
  pop();
}

function mousePressed() {
  if (!isReady) {
    // 强行唤醒音频环境
    if (getAudioContext().state !== 'running') {
      getAudioContext().resume();
    }

    userStartAudio().then(() => {
      mic = new p5.AudioIn();
      mic.start(() => {
        console.log("Mic Started!");
        fft.setInput(mic);
        isReady = true;
      });
    });
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  background(0);
}
