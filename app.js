// DOM 요소 선택
const peakFrequencyElement = document.getElementById('peak-frequency');
const downloadButton = document.getElementById('download-button');
const statusElement = document.getElementById('status');
const canvas = document.getElementById('frequency-chart');
const ctx = canvas.getContext('2d');

// 데이터 저장 배열
let frequencyData = [];

// Chart.js 설정
const chart = new Chart(ctx, {
  type: 'line',
  data: {
    labels: [], // 타임스탬프
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
    scales: {
      x: {
        type: 'time',
        time: {
          unit: 'second',
          tooltipFormat: 'HH:mm:ss'
        },
        title: {
          display: true,
          text: '시간'
        }
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
  const timestamp = new Date();
  frequencyData.push({ timestamp: timestamp.toISOString(), frequency: peakFreq });

  // Chart.js 업데이트
  chart.data.labels.push(timestamp);
  chart.data.datasets[0].data.push(peakFreq);
  
  // X축 데이터 유지 (예: 최근 60초)
  const oneMinuteAgo = new Date(Date.now() - 60000);
  while (chart.data.labels.length > 0 && new Date(chart.data.labels[0]) < oneMinuteAgo) {
    chart.data.labels.shift();
    chart.data.datasets[0].data.shift();
  }

  chart.update('none'); // 애니메이션 없이 업데이트

  // 다음 프레임 요청
  requestAnimationFrame(() => analyze(analyser, audioContext, bufferLength, dataArray));
}

// 데이터 다운로드 함수
function downloadData() {
  if (frequencyData.length === 0) {
    alert('다운로드할 데이터가 없습니다.');
    return;
  }
  const csvHeader = 'Timestamp,Frequency\n';
  const csvRows = frequencyData.map(d => `${d.timestamp},${d.frequency}`).join('\n');
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

// 마이크 접근 및 오디오 설정
navigator.mediaDevices.getUserMedia({ audio: true })
  .then(stream => {
    statusElement.innerText = ''; // 상태 메시지 제거

    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    // 분석 시작
    analyze(analyser, audioContext, bufferLength, dataArray);
  })
  .catch(err => {
    console.error('마이크 접근 실패:', err);
    statusElement.innerText = '마이크 접근에 실패했습니다. 페이지를 새로고침하고 다시 시도해주세요.';
  });
