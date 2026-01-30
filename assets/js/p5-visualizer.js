/* assets/js/p5-visualizer.js */

class Spectrogram {
  constructor(x, y, w, h, lenSec) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.lenSec = lenSec; // 一个屏幕循环的时间
    this.bufferIndex = 0;
    this.samplingRate = sampleRate() || 44100;
    
    // 创建一个离屏画布来保存历史频谱
    this.pg = createGraphics(w, h);
    this.pg.colorMode(HSB, 360, 100, 100, 100);
    this.pg.background(0, 0); // 初始透明
  }

  update(spectrum) {
    if (!spectrum) return;

    // 计算当前时间点对应的 X 坐标
    let totalSamples = this.lenSec * this.samplingRate;
    let xVal = map(this.bufferIndex % totalSamples, 0, totalSamples, 0, this.w);
    
    this.pg.push();
    this.pg.noStroke();
    
    // 每次画新的一列前，先擦除这一小条旧数据，防止重叠
    this.pg.erase();
    this.pg.rect(xVal, 0, 5, this.h);
    this.pg.noErase();

    // 绘制频谱列
    for (let i = 0; i < spectrum.length; i += 4) {
      let amp = spectrum[i];
      if (amp > 10) { // 灵敏度阈值
        let yPos = map(i, 0, spectrum.length, this.h, 0);
        let hueVal = map(i, 0, spectrum.length, 200, 280); // 蓝到紫
        let br = map(amp, 0, 255, 20, 100);
        let alp = map(amp, 0, 255, 30, 100);
        
        this.pg.fill(hueVal, 80, br, alp);
        this.pg.rect(xVal, yPos, 2, 4); // 画一个像素块
      }
    }
    this.pg.pop();

    this.bufferIndex += spectrum.length;
  }

  draw() {
    // 将离屏画布渲染到主屏幕
    image(this.pg, this.x, this.y);
  }
}

let mic, fft, visualizer, isReady = false;

function setup() {
  let cnv = createCanvas(windowWidth, windowHeight);
  cnv.id('p5-background');
  cnv.parent(document.body);
  colorMode(HSB, 360, 100, 100, 100);
  fft = new p5.FFT(0.8, 512);
}

function draw() {
  if (!isReady) {
    background(10);
    fill(255); textAlign(CENTER);
    text("TAP SCREEN TO START", width/2, height/2);
    return;
  }
  
  clear(); // 保持背景透明，透出你的网页内容

  let spectrum = fft.analyze();
  
  if (visualizer && spectrum) {
    visualizer.update(spectrum);
    visualizer.draw();
  }

  // --- 调试用：保留那个会动的红圈，确认数据流没断 ---
  // 如果你觉得干扰，可以把下面这段删掉
  let amp = fft.getEnergy(20, 200);
  push();
  noFill();
  stroke(0, 100, 100, 30); // 淡淡的红圈
  ellipse(width/2, height/2, 50 + amp);
  pop();
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
        // 初始化：15秒扫完一整个屏幕
        visualizer = new Spectrogram(0, 0, width, height, 15);
        isReady = true;
      });
    });
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  // 窗口改变大小时重新初始化，防止拉伸
  if(isReady) visualizer = new Spectrogram(0, 0, width, height, 15);
}
