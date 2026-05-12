const https = require("https");

exports.handler = async function (event) {
  // 1. 파라미터 및 환경변수 로드
  const { lat, lng, radius, fuel } = event.queryStringParameters || {};
  const API_KEY = process.env.OPINET_API_KEY;

  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTION"
  };

  // API 키가 설정되지 않은 경우 대응
  if (!API_KEY) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ error: "Netlify 환경변수에 OPINET_API_KEY가 없습니다." })
    };
  }

  // 2. 좌표 및 파라미터 정제 (오피넷 권장 포맷: 소수점 6자리)
  // x: 경도(127.xxx), y: 위도(37.xxx)
  const x = parseFloat(lng).toFixed(6);
  const y = parseFloat(lat).toFixed(6);
  const r = parseInt(radius || 5) * 1000; // 기본 5km 설정
  const f = fuel || "B027"; // 기본 휘발유

  // 오피넷 API URL (os_nm=WGS84 필수)
  const listUrl = `https://www.opinet.co.kr/api/aroundAll.do?code=${API_KEY}&x=${x}&y=${y}&radius=${r}&prodcd=${f}&sort=1&out=json&os_nm=WGS84`;

  try {
    const responseBody = await new Promise((resolve, reject) => {
      const options = {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://www.opinet.co.kr/'
        }
      };

      https.get(listUrl, options, (res) => {
        res.setEncoding('utf8');
        let body = "";
        res.on("data", chunk => (body += chunk));
        res.on("end", () => resolve(body));
        res.on("error", reject);
      }).on("error", reject);
    });

    const json = JSON.parse(responseBody);

    // 3. 오피넷 응답 상세 분석
    // 오피넷은 에러가 나더라도 RESULT 객체를 보내므로 이를 파싱함
    if (json.RESULT && json.RESULT.CODE !== "000") {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          error: `오피넷 응답 오류: ${json.RESULT.MESSAGE}`, 
          debug: json 
        })
      };
    }

    // 결과 데이터 추출 (대소문자 방어 로직)
    let rawList = json?.RESULT?.OIL || json?.result?.oil || [];
    
    // 결과가 1개일 때 배열이 아닌 객체로 오는 경우 처리
    if (rawList && !Array.isArray(rawList)) {
      rawList = [rawList];
    }

    // 데이터가 아예 없는 경우
    if (rawList.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          error: "주변 5km 이내에 주유소가 없습니다.", 
          debug: json // 오피넷이 보낸 원본 데이터를 같이 보냄
        })
      };
    }

    // 4. 프론트엔드용 데이터 가공
    const stations = rawList.map(s => ({
      id: s.UNI_ID || s.uni_id,
      name: s.OS_NM || s.os_nm,
      brand: s.POLL_DIV_CD || s.poll_div_cd,
      price: parseInt(s.PRICE || s.price || 0),
      dist: Math.round(s.DISTANCE || s.distance || 0),
      isSelf: (s.SELF_YN || s.self_yn) === "Y",
      is24h: (s.OPNG_HH === "00" || s.opng_hh === "00") && (s.CLSG_HH === "00" || s.clsg_hh === "00")
    })).filter(s => s.price > 0);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(stations)
    };

  } catch (e) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "서버 통신 실패: " + e.message })
    };
  }
};
