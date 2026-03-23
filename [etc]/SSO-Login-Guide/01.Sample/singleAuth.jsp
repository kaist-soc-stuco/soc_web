<%@page import="ch.qos.logback.core.recovery.ResilientSyslogOutputStream"%>
<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8" %>

<%@ page import="java.io.BufferedReader" %>
<%@ page import="java.io.IOException" %>
<%@ page import="java.io.InputStreamReader" %>
<%@ page import="java.io.OutputStream" %>
<%@ page import="java.io.OutputStreamWriter" %>
<%@ page import="java.io.BufferedWriter" %>

<%@ page import="javax.net.ssl.HttpsURLConnection" %>
<%@ page import="javax.net.ssl.SSLContext" %>
<%@ page import="javax.net.ssl.TrustManager" %>
<%@ page import="javax.net.ssl.HostnameVerifier" %>
<%@ page import="javax.net.ssl.SSLSession" %>
<%@ page import="javax.net.ssl.X509TrustManager" %>

<%@ page import="java.util.HashMap" %>
<%@ page import="java.util.Map" %>
<%@ page import="java.net.URL" %>
<%@ page import="java.net.URLEncoder" %>
<%@ page import="java.net.HttpURLConnection" %>

<%@ page import="java.security.SecureRandom" %>
<%@ page import="java.security.cert.X509Certificate" %>
<%@ page import="java.security.cert.CertificateException" %>

<%@ page import="org.json.simple.parser.JSONParser" %>
<%@ page import="org.json.simple.JSONObject" %>

<%
	// 단일인증 연동시스템 아이디
	String client_id = "single-auth-test";
	// 단일인증 연동시스템 식별키
	String client_secret = "E00C245F457215CD09476ACB0821E3ED851AACD3EC19F9ACB3ED79326B657AAE";
	// 단일인증 페이지 호출 시 보냈던 값 동일( SSO 서버에서 검증을 위하여 쓰임 )
	String redirect_uri = "https://ssolocal.kaist.ac.kr:8443/passni5/sample/singleAuth.jsp";
	// 단일인증 사용자 정보 API URL
	String server_api_url = "https://ssolocal.kaist.ac.kr/auth/api/single/auth";
	
	String rtnCode = "";

	// 단일인증 완료 후 SSO 서버로 부터 전달받은 일회성 코드 값
	String code = (String) request.getParameter( "code" );
	
	String req_state = (String) request.getParameter( "state" );
	String ses_state = (String) session.getAttribute( "state" );
	
	// 단일인증 페이지 호출 시 Agent에서 전달한 값과 SSO 서버로 부터 전달 받은 값 비교( CSRF 방지 )
	if( req_state.equals( ses_state ) ) {
		
		HashMap<String, String> reqMap = new HashMap<String, String>();
		reqMap.put( "client_id", client_id );
		reqMap.put( "client_secret", client_secret );
		reqMap.put( "code", code );
		reqMap.put( "redirect_uri", redirect_uri );
		
		if( code != null ) {
			String responseData = httpsConnect( server_api_url, reqMap );
			
			if( responseData != null && !"".equals( responseData ) ) {							
				
		 		JSONParser jsonParse = new JSONParser();
		 		HashMap<String, Object> jsonMap = (HashMap<String, Object>) jsonParse.parse( responseData );
		 		
		 		rtnCode = (String) jsonMap.get( "errorCode" );
		 		
				if( rtnCode == null ) {
					
					String ses_nonce = (String) session.getAttribute( "nonce" );
					String res_nonce = (String) jsonMap.get( "nonce" );
					
					if( ses_nonce.equals( res_nonce ) ) {
						
						String user_data = jsonMap.get( "userInfo" ).toString();
						
						HashMap<String, Object> userMap = (HashMap<String, Object>) jsonParse.parse( user_data );
						
						System.out.println( userMap.get( "user_mbtlnum" ) );
					}
					
				}
			}

		}
	}
	
%>

<%!
	private String httpsConnect( String reqUrl, HashMap<String, String> urlParam ) {
	
		BufferedWriter bufferedWriter = null;
		BufferedReader bufferedReader = null;
	
		try {
			TrustManager[] trustAllCertificates = new TrustManager[] { new X509TrustManager() {
	
				@Override
				public X509Certificate[] getAcceptedIssuers() {
	
					return null; // Not relevant.
				}
	
				@Override
				public void checkClientTrusted( X509Certificate[] certs, String authType ) {
	
				}
	
				@Override
				public void checkServerTrusted( X509Certificate[] certs, String authType ) {
	
				}
			} };
	
			HostnameVerifier trustAllHostnames = new HostnameVerifier() {
	
				@Override
				public boolean verify( String hostname, SSLSession session ) {
	
					return true;
				}
			};
	
			SSLContext sc = SSLContext.getInstance( "SSL" );
			sc.init( null, trustAllCertificates, new SecureRandom() );
			
			URL url = new URL( reqUrl );
			HttpsURLConnection connection = ( HttpsURLConnection )url.openConnection();
	
			connection.setRequestProperty( "Content-Type", "application/x-www-form-urlencoded;charset=utf-8" );
			connection.setRequestMethod( "POST" );
			connection.setConnectTimeout( 3000 );
			connection.setDoOutput( true );
			connection.setDoInput( true );
			connection.setUseCaches( false );
			connection.setDefaultUseCaches( false );
			connection.setRequestProperty( "Connection", "close" );
			
			connection.setSSLSocketFactory( sc.getSocketFactory() );
			connection.setHostnameVerifier( trustAllHostnames );
			
			StringBuilder postData = new StringBuilder();
			
			for( Map.Entry<String, String> params: urlParam.entrySet() ) {
				
				if(postData.length() != 0) {
					postData.append( "&" );
				}
				postData.append( URLEncoder.encode( params.getKey(), "UTF-8" ) );
				postData.append( "=" );
				postData.append( URLEncoder.encode( String.valueOf( params.getValue() ), "UTF-8" ) );
			}

			byte[] postDataBytes = postData.toString().getBytes( "UTF-8" );
			
			connection.getOutputStream().write( postDataBytes );

			int responseCode = connection.getResponseCode();
			
			if( responseCode == HttpURLConnection.HTTP_OK ) {
				bufferedReader = new BufferedReader( new InputStreamReader( connection.getInputStream() ) );

				StringBuffer data = new StringBuffer();
				String buffer = "";
				while( ( buffer = bufferedReader.readLine() ) != null ) {
					data.append( buffer );
				}

				bufferedReader.close();

				return data.toString();

			} else {

			}

			connection.disconnect();

		} catch( Exception e ) {

			e.printStackTrace();

		} finally {
			if( bufferedWriter != null ) {
				try {
					bufferedWriter.close();
				} catch( IOException e ) {
				}
				bufferedWriter = null;
			}

			if( bufferedReader != null ) {
				try {
					bufferedReader.close();
				} catch( IOException e ) {
				}
				bufferedReader = null;
			}
		}

		return null;
	}
%>

<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=900" />
<title>Pass-Ni SSO Sample Page</title>
	
	<!--[if lt IE 9]>
	<script src="http://html5shiv.googlecode.com/svn/trunk/html5.js"></script>
	<![endif]--> 
	
	<!--[if lt IE 7]>
	<script src="http://ie7-js.googlecode.com/svn/version/2.1(beta4)/IE8.js"></script>
	<![endif]--> 
	
	<!--[if lt IE 9]>
	<script src="http://ie7-js.googlecode.com/svn/version/2.1(beta4)/IE9.js"></script>
	<![endif]-->
	
	<!--[if lt IE 9]>
	<script src="http://css3-mediaqueries-js.googlecode.com/svn/trunk/css3-mediaqueries.js"></script>
	<![endif]-->
		
<link rel="stylesheet" type="text/css" href="css/default.css" />
<link rel="stylesheet" type="text/css" href="css/style2.css" />

<script type="text/javascript" src="js/jquery-1.8.1.min.js"></script>

<script type="text/javascript">

</script>

</head>
<body>

	<div class="wrap">
		<h1>&nbsp; &nbsp; &nbsp;Pass-Ni SSO Sample Page ( 단일인증 )</h1>
		
		<div class="bg-section">
			<div class="block1">
				<p><span class="tit">사용자 아이디/비밀번호 를 검증한다.</span><span class="cont">&nbsp;&nbsp; 예제</span></p>
				<ul class="list-style">
					<li>
						<span class="tit color">예제 실행 결과</span>
						<br/>
						<span class="cont">
<%-- 							&nbsp; [ ErrorCode ] <%=rtnCode %><br/> --%>
						</span>
					</li>
				</ul>
			</div>
		</div>
		
	</div>

</body>
</html>
