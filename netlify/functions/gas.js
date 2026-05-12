const https = require("https");

exports.handler = async function (event) {
  const { lat, lng, radius, fuel } = event.queryStringParameters || {};
  const API_KEY = process.env.OPINET_API_KEY;

  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTION"
  };

  // 파라미터 체크
  if (!lat || !lng || !radius || !fuel) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "필수 파라미터가 누락되었습니다." }) };
  }

  // 1. 좌표 정밀도 조정 및 변환 (x=경도, y=위도)
  const x = parseFloat(lng).toFixed(6);
  const y = parseFloat(lat).toFixed(6);
  const r = parseInt(radius) * 1000;

  // 2. 오피넷 API URL 생성 (os_nm=WGS84 필수)
  const listUrl = `https://www.opinet.co.kr/api/aroundAll.do?code=${API_KEY}&x=${x}&y=${y}&radius=${r}&prodcd=${fuel}&sort=1&out=json&os_nm=WGS84`;

  try {
    const data = await fetchWithSecurity(listUrl);
    const json = JSON.parse(data);

    // 3. 응답 구조 방어적 파싱
    let rawList = json?.RESULT?.OIL || json?.result?.oil || [];
    
    // 결과가 1개일 때 배열이 아닌 객체로 오는 경우 처리
    if (rawList && !Array.isArray(rawList)) {
      rawList = [rawList];
    }

    const stations = rawList.map(s => ({
      id: s.UNI_ID || s.uni_id,
      name: s.OS_NM || s.os_nm,
      brand: s.POLL_DIV_CD || s.poll_div_cd,
      price: parseInt(s.PRICE || s.price || 0),
      dist: Math.round(s.DISTANCE || s.distance || 0),
      isSelf: (s.SELF_YN || s.self_yn) === "Y",
      is24h: (s.OPNG_HH === "00" || s.opng_hh === "00") && (s.CLSG_HH === "00" || s.clsg_hh === "00")
    })).filter(s => s.price > 0); // 가격 정보가 있는 것만 필터링

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(stations)
    };

  } catch (e) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "서버 통신 오류: " + e.message })
    };
  }
};

// 오피넷 서버의 헤더 체크를 우회하기 위한 헬퍼 함수
function fetchWithSecurity(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.opinet.co.kr/'
      }
    };

    https.get(url, options, (res) => {
      res.setEncoding('utf8');
      let body = "";
      res.on("data", chunk => (body += chunk));
      res.on("end", () => resolve(body));
      res.on("error", reject);
    }).on("error", reject);
  });
}
