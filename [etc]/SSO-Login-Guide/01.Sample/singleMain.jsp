<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8"%>

<%
	// 단일인증 연동시스템 아이디
	String client_id = "single-auth-test";
	// 단일인증 로그인 페이지 URL
	String server_app_url = "https://ssodev.kaist.ac.kr/auth/user/single/login/authorize";
	// 단일인증 완료 후 리턴 URI( SSO 관리자 페이지에 등록되어 있는 URI )
	String redirect_uri = "https://단일인증시스템Domain/sample/singleAuth.jsp";
	// 단일인증 완료 후 전달되는 값, CSRF 방지
	String state = "random1";
	// 사용자 정보 조회 시 전달되는 값, Replay Attack 방지
	String nonce = "random2";
	
	session.setAttribute( "state", state );
	session.setAttribute( "nonce", nonce );
	

%>

<!DOCTYPE html>
<html lang="ko">
<head>
<title>Pass-Ni SSO Slgne Agent Sample</title>
<meta charset="UTF-8">
<meta http-equiv="X-UA-Compatible" content="IE=edge, chrome=1">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0">

<link rel="icon" href="img/favicon.ico"  />
<link rel="stylesheet" href="css/default.css" />

<script type="text/javascript" src="js/jquery-3.6.3.min.js"></script>
<script type="text/javascript" src="js/countdown.js"></script>

<script type="text/javascript">

var client_id = '<%=client_id%>';
var server_url = '<%=server_app_url%>';
var redirect_uri = '<%=redirect_uri%>';
var state = '<%=state%>';
var nonce = '<%=nonce%>';

function fnLogin() {
	$('#loginForm').attr('action', server_url).submit();
}

</script>

</head>

<body>

	<form name="loginForm" id="loginForm" method="post" action="">
		<input type="hidden" id="client_id" name="client_id" value="<%=client_id%>" />
		<input type="hidden" id="redirect_uri" name="redirect_uri" value="<%=redirect_uri%>" />
		<input type="hidden" id="state" name="state" value="<%=state%>" />
		<input type="hidden" id="nonce" name="nonce" value="<%=nonce%>" />
	</form>
	
	<div class="wrap">
		<h1>Pass-Ni SSO Single Agent 샘플 화면</h1>
	</div>
	
	<div class="bg-section">
		<div class="wrap">
			<div class="block1">
				<p><span class="tit">연동시스템 정보</span></p>
				<table>
					<tr>
						<td width="90px"><span class="subtit">Agent Info</span></td>
						<td width="*"><span class="cont">ID : <%=client_id%></span></td>
					</tr>
					<tr>
						<td><span class="subtit">Server URL</span></td>
						<td><span class="cont"><%=server_app_url%></span></td>
					</tr>
				</table>
				<p style="padding-top: 30px;"><span class="tit">사용자 정보</span></p>
				<table>
					<tr>
						<td><span class="subtit">사용자 정보</span></td>
						<td><span class="cont"><%=user_data%></span></td>
					</tr>
				</table>
			</div>
		</div>
	</div>
	
	<div class="wrap">
		<ul class="icon-bt">
			<li><a href="javascript:fnLogin();"><img src="img/bt-3.jpg" alt="단일 로그인" /></a></li>
			<li class="subtit"><a href="javascript:fnLogin();">단일 로그인</a></li>
			<li class="cont">( 단일 로그인 화면 호출 )</li>
		</ul>
	</div>
	
</body>
</html>
