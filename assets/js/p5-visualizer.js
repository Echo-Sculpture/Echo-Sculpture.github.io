/* assets/js/p5-visualizer.js */

class Spectrogram {
  constructor(x, y, w, h, lengthInSeconds) {
    this.x = x; this.y = y; this.width = w; this.height = h;
    this.samplingRate = sampleRate() || 44100;
    this.lengthInSeconds = lengthInSeconds;
    this.bufferIndex = 0;

    // 核心：基于你源码的双缓冲滚动逻辑
    this.gfx1 = createGraphics(this.width, this.height);
    this.gfx2 = createGraphics(this.width, this.height);
    this.gfx1.colorMode(HSB, 360, 100, 100, 100);
    this.gfx2.colorMode(HSB, 360, 100, 100, 100);
    
    this.gfx1.x = 0;
    this.gfx2.x = this.width;
  }

  update(spectrum) {
    if (!spectrum) return;

    // 1. 计算当前 X 像素位置
    let totalSamples = this.lengthInSeconds * this.samplingRate;
    let xBufferVal = map(this.bufferIndex, 0, totalSamples, 0, this.width);
    let xVal = xBufferVal % this.width;
    let selectOffscreenBuffer = floor(xBufferVal / this.width) % 2;

    // 2. 决定哪个缓冲区在主位，并处理偏移（实现滚动感）
    if (selectOffscreenBuffer === 0) {
      this.gfx1.x = -xVal;
      this.gfx2.x = this.width - xVal;
    } else {
      this.gfx1.x = this.width - xVal;
      this.gfx2.x = -xVal;
    }

    let activeGfx = (selectOffscreenBuffer === 0) ? this.gfx1 : this.gfx2;

    // 3. 在活跃缓冲区绘图
    activeGfx.push();
    activeGfx.noStroke();
    
    // 渲染列逻辑：每 4 个频点取样，模仿你原代码的细腻感
    for (let i = 0; i < spectrum.length; i += 4) {
      let amp = spectrum[i];
      if (amp > 15) {
        let yPos = map(i, 0, spectrum.length, this.height, 0);
        // 垂直色调映射：从冷青到暖紫 (180° - 300°)
        let hueVal = map(i, 0, spectrum.length, 180, 280); 
        let brightness = map(amp, 0, 255, 30, 100);
        let alpha = map(amp, 0, 255, 40, 100);
        
        activeGfx.fill(hueVal, 75, brightness, alpha);
        // 像素块设计：宽度略窄，高度略长，形成垂直律动感
        activeGfx.rect(xVal, yPos, 3, 5, 1); 
      }
    }
    activeGfx.pop();

    this.bufferIndex += spectrum.length;
  }

  draw() {
    // 绘制两个缓冲区，实现无缝循环
    image(this.gfx1, this.gfx1.x, this.y);
    image(this.gfx2, this.gfx2.x, this.y);
  }
}

let mic, fft, visualizer, isReady = false;

function setup() {
  let cnv = createCanvas(windowWidth, windowHeight);
  cnv.id('p5-background');
  cnv.parent(document.body);
  colorMode(HSB, 360, 100, 100, 100);
  
  // 采样率越高，频谱越细腻
  fft = new p5.FFT(0.85, 1024);
}

function draw() {
  if (!isReady) {
    background(10);
    fill(255); textAlign(CENTER); textSize(16);
    text("INTERACTIVE SPECTROGRAM: CLICK TO ACTIVATE", width/2, height/2);
    return;
  }
  
  // 必须保持 clear() 才能看到网页正文
  clear();

  let spectrum = fft.analyze();
  if (visualizer && spectrum) {
    visualizer.update(spectrum);
    visualizer.draw();
  }
}

function mousePressed() {
  if (!isReady) {
    if (getAudioContext().state !== 'running') {
      getAudioContext().resume();
    }
    userStartAudio().then(() => {
      mic = new p5.AudioIn();
      mic.start(() => {
        fft.setInput(mic);
        // lengthInSeconds = 20: 意味着 20 秒滚完一屏，速度更稳重优雅
        visualizer = new Spectrogram(0, 0, width, height, 20);
        isReady = true;
      });
    });
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  // 窗口重置时重刷缓冲区，确保画面不拉伸
  if(isReady) visualizer = new Spectrogram(0, 0, width, height, 20);
}
