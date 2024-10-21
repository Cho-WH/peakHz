// DOM 요소 선택
const peakFrequencyElement = document.getElementById('peak-frequency');
const startButton = document.getElementById('start-button');
const stopButton = document.getElementById('stop-button');
const resetButton = document.getElementById('reset-button');
const downloadButton = document.getElementById('download-button');
const statusElement = document.getElementById('status');
const canvas = document.getElementById('frequency-chart');
const ctx = canvas.getContext('2d');

console.log('app.js가 정상적으로 로드되었습니다.');

// 데이터 저장 배열
let frequencyData = [];
let recording = false;
let startTime = null;
let animationId = null;
let audioStream = null;

// Chart.js 설정
const chart = new Chart(ctx, {
  type: 'line',
  data: {
    datasets: [{
      label: 'Peak Frequency (Hz)',
      data: [],
      borderColor: 'rgba(75, 192, 192, 1)',
      borderWidth: 2,
      fill: false,
      tension: 0.1
    }]
  },
  options: {
    responsive: true,
    animation: false,
    interaction: {
      mode: 'nearest',    // 'nearest' 모드 설정
      axis: 'x',          // x축을 기준으로 상호작용
      intersect: false    // 데이터 포인트와 교차하지 않아도 툴팁 표시
    },
    scales: {
      x: {
        type: 'linear',
        position: 'bottom',
        title: {
          display: true,
          text: '시간 (초)'
        },
        ticks: {
          callback: function(value, index, values) {
            return Math.floor(value);  // 소수점 제거 (정수로 변환)
          }
        },
        min: 0,
        max: 10
      },
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: '주파수 (Hz)'
        }
      }
    },
    plugins: {
      legend: {
        display: true
      },
      tooltip: {
        enabled: true,
        mode: 'nearest',
        intersect: false,
        callbacks: {
          title: function(context) {
            return '';
          },
          label: function(context) {
            return `${context.parsed.y.toFixed(2)}Hz`;
          },
          footer: function(context) {
            // context 및 context.parsed.x가 존재하는지 확인
            const xValue = context.length && context[0].parsed && context[0].parsed.x;
            return xValue ? `${xValue.toFixed(3)}초` : '';  // x축 값이 있을 경우에만 표시
          }
        },
        displayColors: false,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        titleFont: {
          size: 14,
          weight: 'bold'
        },
        bodyFont: {
          size: 12
        }
      }
    }
  }
});

// 피크 주파수 찾기 함수
function getPeakFrequency(dataArray, audioContext, fftSize) {
  let max = -Infinity;
  let index = -1;
  dataArray.forEach((value, i) => {
    if (value > max) {
      max = value;
      index = i;
    }
  });
  const frequency = index * audioContext.sampleRate / fftSize;
  return frequency;
}

// 오디오 분석 함수
function analyze(analyser, audioContext, bufferLength, dataArray) {
  analyser.getByteFrequencyData(dataArray);
  const peakFreq = getPeakFrequency(dataArray, audioContext, analyser.fftSize);

  // 피크 주파수 업데이트
  peakFrequencyElement.innerText = `Peak Frequency: ${peakFreq.toFixed(2)} Hz`;

  // 데이터 기록
  const currentTime = (Date.now() - startTime) / 1000; // 초 단위
  frequencyData.push({ time: currentTime, frequency: peakFreq });

  // Chart.js 업데이트
  chart.data.datasets[0].data.push({ x: currentTime, y: peakFreq });

  // X축 데이터 유지 (최근 10초)
  chart.options.scales.x.min = Math.max(0, currentTime - 10);
  chart.options.scales.x.max = currentTime > 10 ? currentTime : 10;

  chart.update('none'); // 애니메이션 없이 업데이트

  // 다음 프레임 요청
  animationId = requestAnimationFrame(() => analyze(analyser, audioContext, bufferLength, dataArray));
}

// 데이터 다운로드 함수
function downloadData() {
  if (frequencyData.length === 0) {
    alert('다운로드할 데이터가 없습니다.');
    return;
  }
  const csvHeader = 'Time (s),Frequency (Hz)\n';
  const csvRows = frequencyData.map(d => `${d.time.toFixed(2)},${d.frequency}`).join('\n');
  const csvContent = csvHeader + csvRows;

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `frequency_data_${new Date().toISOString()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// 다운로드 버튼 이벤트 리스너
downloadButton.addEventListener('click', downloadData);

// 녹음 시작 함수
function startRecording(stream) {
  if (recording) return;
  recording = true;
  startTime = Date.now();
  frequencyData = [];
  chart.data.datasets[0].data = [];
  chart.options.scales.x.min = 0;
  chart.options.scales.x.max = 10;
  chart.update();

  // 버튼 상태 변경
  startButton.disabled = true;
  stopButton.disabled = false;
  resetButton.disabled = false;
  downloadButton.disabled = true;

  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  const source = audioContext.createMediaStreamSource(stream);
  source.connect(analyser);

  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  // 분석 시작
  analyze(analyser, audioContext, bufferLength, dataArray);
}

// 녹음 중지 함수
function stopRecording() {
  if (!recording) return;
  recording = false;

  // 버튼 상태 변경
  startButton.disabled = false;
  stopButton.disabled = true;
  downloadButton.disabled = frequencyData.length === 0;

  // 오디오 스트림 중지
  if (audioStream) {
    audioStream.getTracks().forEach(track => track.stop());
  }

  // 애니메이션 프레임 취소
  if (animationId) {
    cancelAnimationFrame(animationId);
  }
}

// 녹음 리셋 함수
function resetRecording() {
  if (recording) return;
  frequencyData = [];
  chart.data.datasets[0].data = [];
  chart.update();

  // 버튼 상태 변경
  resetButton.disabled = true;
  downloadButton.disabled = true;
}

// 녹음 시작 버튼 이벤트 리스너
startButton.addEventListener('click', () => {
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      audioStream = stream;
      statusElement.innerText = ''; // 상태 메시지 제거
      startRecording(stream);
    })
    .catch(err => {
      console.error('마이크 접근 실패:', err);
      statusElement.innerText = '마이크 접근에 실패했습니다. 페이지를 새로고침하고 다시 시도해주세요.';
    });
});

// 녹음 중지 버튼 이벤트 리스너
stopButton.addEventListener('click', stopRecording);

// 리셋 버튼 이벤트 리스너
resetButton.addEventListener('click', resetRecording);
