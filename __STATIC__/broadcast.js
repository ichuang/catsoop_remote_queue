
var CatsoopBroadcast = function(){

    var opacity = 0;
    var div_id = "cs_broadcast_msg_div";
    var minfo;	// message info
    var seen = [];
    var poll_period_ms = 1500;
    var positioner_started = false;
    var iframe_ntries = 20;
    var n_poll_errors = 0;

    var get_state = function(){
	try{
	    seen = JSON.parse(window.localStorage.getItem('cs_broadcast'));
	    if (!seen){
		seen = [];
	    }
	}
	catch (err){
	    console.log("No cs_broadcast state? err=", err);
	    seen = [];
	}
    }

    var has_message_been_seen = function(){
	get_state();
	if (minfo && minfo.datetime && seen && seen.length && seen.includes(minfo.datetime)){
	    // console.log(`cs_broadcast already seen msg=${minfo.datetime}`);
	    return true;
	}
	return false;
    }

    var set_message_seen = function(){
	get_state();
	seen.push(minfo.datetime);
	window.localStorage.setItem('cs_broadcast', JSON.stringify(seen));
    }

    var get_msg = function(){
	// load msg via ajax and popup, if not expired, and if not already seen
	// var url = "/cat-soop/6.036/broadcast?get";
	var url = `${CS_COURSE_URL}/broadcast?get`;
	// console.log("[load_msg] Loading msg from ", url);

	var xmlhttp = new XMLHttpRequest();

	xmlhttp.onreadystatechange = function() {
	    if (xmlhttp.readyState == XMLHttpRequest.DONE) {   // XMLHttpRequest.DONE == 4
		if (xmlhttp.status == 200) {
		    process_msg(xmlhttp.responseText);
		    n_poll_errors = 0;
		}
		else if (xmlhttp.status == 400) {
		    console.log('[load_msg] There was an error 400');
		    n_poll_errors = n_poll_errors + 1;
		}
		else {
		    console.log('[load_msg] something else other than 200 was returned');
		    n_poll_errors = n_poll_errors + 1;
		}
	    }
	};
	xmlhttp.open("GET", url, true);
	xmlhttp.send();
    }

    var process_msg = function(msgjson){
	if (!msgjson){
	    return;
	}
	var new_minfo;
	try{
	    new_minfo = JSON.parse(msgjson);
	}catch(err){
	    console.log(`[load_msg] failed to parse ${minfo}, err=${err}`);
	    return;
	}
	if (!new_minfo.datetime){
	    console.log(`[load_msg] malformed msg ${minfo}, no date...skipping`);
	    return;
	}
	if (minfo && new_minfo==minfo.datetime){	// same message as current one
	    return;
	}
	minfo = new_minfo;
	var mdate = Date.parse(minfo.datetime);
	var now = new Date();
	var ddifsec = (now.getTime() - mdate) / 1000;
	if (ddifsec > 3*60){
	    console.log(`[load_msg] message ${minfo.datetime} has expired, skipping`);
	    return;
	}
	if (has_message_been_seen()){
	    // console.log(`[load_msg] already seen message ${minfo.datetime}`);
	    return;
	}
	try{
	    if (minfo.audience=="staff" && !CS_USER_IS_STAFF){
		console.log(`[load_msg] staff-only message ${minfo.datetime}, skipping`);
		return;
	    }
	}catch(err){
	    console.log("[load_msg] error when checking message audience: ", err);
	}

	// console.log("[load_msg] showing message ", minfo);
	var cbm = document.querySelector('#cs_broadcast_msg');
	cbm.innerHTML = minfo.msg;

	var cbmt = document.querySelector('#cs_broadcast_time');
	var dt = minfo.datetime.substring(0, minfo.datetime.length-7)
	cbmt.innerHTML = `[${minfo.creator}:${dt}]`;

	setup_message_position();
	make_message_visible();
	// rd = document.querySelector('#msg_div');
	// rd.innerHTML = ;
    }

    var irr = function(x){	// receive parent page position info, including scrollTop
	var st = x.scrollTop;
	var ch = x.clientHeight;
	var qd = document.querySelector(`#${div_id}`);
	var height = window.innerHeight;
	var newbot = height - st - ch + 600;
	if (x.iframeHeight < (x.clientHeight + 500)){
	    newbot += 70;
	}
	// console.log("[load_msg] auto-positioner irr, x=", x);
	if (newbot < 0){ newbot = 0; }
	// qd.css({bottom: String(newbot) + "px"});
	qd.style.bottom = String(newbot) + "px";
    }

    var auto_positioner = function(){
	window.parentIFrame.getPageInfo(irr);
	setTimeout(auto_positioner, 150);
    }

    var setup_message_position = function(){  // get vertical position to place message (for iframe)
	if (positioner_started){
	    return;
	}
	if (!iframe_ntries){
	    return;
	}
	iframe_ntries = iframe_ntries - 1;
	if ('parentIFrame' in window) {
	    positioner_started = true;
	    auto_positioner();
	}else{
	    setTimeout(setup_message_position, 500);
	}
    }

    var make_message_visible = function(){
	var cbm = document.querySelector(`#${div_id}`);
	cbm.style.opacity = opacity;
	cbm.style.visibility = "visible";
	if (opacity < 1){
	    opacity += 0.025;
	    setTimeout(make_message_visible, 20);
	}
    }

    var close_msg = function(){
	// hide message, and record in local store that this message has been seen
	var cbm = document.querySelector(`#${div_id}`);
	cbm.style.visibility = "hidden";
	opacity = 0;
	set_message_seen();
    }

    var msg_check = function(){
	// console.log("msg_check!");
	get_msg();
	if (n_poll_errors < 20){
	    setTimeout(msg_check, poll_period_ms);
	}
    };

    var setup_msg_box = function(){
	var node = document.createElement("div");
	node.id = div_id;
	node.classList.add("csBroadcastMsg");
	var html = "<span id='cs_broadcast_msg' class='csBroadcastMsgText'></span>";
	html += "<span  id='cs_broadcast_close' class='csBroadcastMsgClose'>&#9747</span>";
	html += "<span  id='cs_broadcast_time' class='csBroadcastMsgTime'></span>";
	node.innerHTML = html;

	document.body.append(node);
	document.querySelector('#cs_broadcast_close').addEventListener("click", close_msg);
	setTimeout(msg_check, poll_period_ms);
    }

    var setup = function(){
	if (
	    document.readyState === "complete" ||
		(document.readyState !== "loading" && !document.documentElement.doScroll)
	) {
	    setup_msg_box();
	} else {
	    document.addEventListener("DOMContentLoaded", setup_msg_box);
	}
    }

    var doit = function(x){
	return eval(x);
    }

    return { setup: setup,
	     doit: doit,
	     irr: irr,
	   }
}

CB = CatsoopBroadcast();
CB.setup();
