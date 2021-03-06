/*eslint no-console: 0, no-shadow: 0, new-cap: 0, quotes: 0, no-unused-vars: 0*/

var express = require("express");
var app = express();

var xsenv = require("@sap/xsenv");
var hdbext = require("@sap/hdbext");

var bodyParser = require('body-parser');
var https = require('https');
var axios = require('axios');
var async = require("async");
var moment = require("moment");

var hanaOptions = xsenv.getServices({
	hana: {
		tag: "hana"
	}
});
app.use(
	hdbext.middleware(hanaOptions.hana)
);
app.use(bodyParser.urlencoded({
	extended: true
}));
app.use(bodyParser.json());

var port = process.env.PORT || 3000;
app.listen(port, function () {
	console.info("Listening on port: " + port);
});

var sort_by = function(field, reverse, primer){
   reverse = (reverse) ? -1 : 1;
   return function(a,b){
       a = a[field];
       b = b[field];
       if (typeof(primer) != 'undefined'){
           a = primer(a);
           b = primer(b);
       }
       if (a<b) return reverse * -1;
       if (a>b) return reverse * 1;
       return 0;
   }
};

function execInsertRailDirection(req, res, vODPTRailDirection, inboundRailDirection) {
	var sql = 'INSERT INTO "opd-test.opd-test-db::tables.RailDirection" VALUES(\'' +
		vODPTRailDirection + '\',\'' + inboundRailDirection + '\')';
	console.log(req.db);
	req.db.exec(sql, function (err, results) {
		if (err) {
			res.type("text/plain").status(500).send("ERROR: " + err.toString());
		}
	});
}

function execInsertRailway(req, res, vODPTRailway, inboundRailway,vODPTOperator,vOperatorTitle,StationOrder) {
	try{
		var sql = '';
		if(StationOrder.length !== 0){
			
			var insert_values = '';
			var OperatorTxt = vOperatorTitle.replace(/電鉄|鉄道/,'');
			console.log("Operator is"+vOperatorTitle + " ->" + OperatorTxt);
			StationOrder.forEach(function (eleStation) {
				sql = 'INSERT INTO "opd-test.opd-test-db::tables.Railway" VALUES(\''+ inboundRailway +'\',\''+ vODPTOperator + '\',\'' +vODPTRailway  + '\',\'' + eleStation["odpt:station"] + '\',\'' + eleStation["odpt:index"] +'\',0)';
				req.db.exec(sql, function (err, results) {
					if (err) {
						console.log(sql);
						console.log("ERROR: " + err.toString());
					}
				});
				sql = 'INSERT INTO "opd-test.opd-test-db::tables.Railway" VALUES(\''+ OperatorTxt+inboundRailway +'\',\''+ vODPTOperator + '\',\'' + vODPTRailway + '\',\'' + eleStation["odpt:station"] + '\',\'' + eleStation["odpt:index"] +'\',0)';
				req.db.exec(sql, function (err, results) {
					if (err) {
						console.log(sql);
						console.log("ERROR: " + err.toString());
					}
				});
			});
		}else{
			sql = 'INSERT INTO "opd-test.opd-test-db::tables.Railway" VALUES(\'' + inboundRailway  +'\',\''+ vODPTRailway + '\',\'' + vODPTOperator + '\',null,null,0)' ;
			req.db.exec(sql, function (err, results) {
			if (err) {
				console.log(sql);
				console.log("ERROR: " + err.toString());
			}
		});
		}
	}
	catch(e){
		console.log(e);
	}
}

function execInsertStation(req, res, vODPTRailway, vODPTStation, inboundStation) {
	sql = 'INSERT INTO "opd-test.opd-test-db::tables.Station" VALUES(\'' +
		vODPTRailway + '\',\'' + vODPTStation + '\',\'' + inboundStation + '\')';
	req.db.exec(sql, function (err, results) {
		if (err) {
			res.type("text/plain").status(500).send("ERROR: " + err.toString());
		}
	});
}

function execInsertOperator(req, res, vODPTOperator, vODPTOperatorTitle) {
	sql = 'INSERT INTO "opd-test.opd-test-db::tables.Operator" VALUES(\'' +
			vODPTOperator + '\',\'' + vODPTOperatorTitle + '\')';
	req.db.exec(sql, function (err, results) {
		if (err) {
			console.log("ERROR: " + err.toString());
		}
	});
}

function hiraganaAPI(vInboundWord, vOutputType) {
	return new Promise(function (resolve, reject) {
		var options = {
			method: "post",
			url: "https://labs.goo.ne.jp/api/hiragana",
			headers: {
				"Content-Type": "application/json"
			},
			data: {
				"app_id": "0f3b82b8e712998465f2c7848dbaa8af322e826765dcc5e5dcd74c6f360d2595",
				"sentence": vInboundWord,
				"output_type": vOutputType
			}
		};
		axios(options)
			.then(function (apiRes) {
				resolve(apiRes.data.converted);
			})
			.catch(function (apiErr) {
				reject(apiErr);
			});
		//resolve(vInboundWord + " " + vOutputType);
	});
}

function datetostr(date, format, is12hours) {
    if (!format) {
        format = 'YYYY年MM月DD日(WW) hh:mm:dd(JST)'
    }
    var weekday = ["日", "月", "火", "水", "木", "金", "土"];
    var year = date.getFullYear();
    var month = (date.getMonth() + 1);
    var day = date.getDate();
    var weekday = weekday[date.getDay()];
    var hours = date.getHours();
    var minutes = date.getMinutes();
    var secounds = date.getSeconds();
	
	hours = hours + 9; // GMT処理
	
    var ampm = hours < 12 ? '午前' : '午後';
    
    if (is12hours) {
        hours = hours  % 12;
        hours = (hours != 0) ? hours : 12; // 12時＝0時
    }

    var replaceStrArray =
        {
            'YYYY': year,
            'Y': year,
            'MM': ('0' + (month)).slice(-2),
            'M': month,
            'DD': ('0' + (day)).slice(-2),
            'D': day,
            'WW': weekday,
            'hh': ('0' + hours).slice(-2),
            'h': hours,
            'mm': ('0' + minutes).slice(-2),
            'm': minutes,
            'ss': ('0' + secounds).slice(-2),
            's': secounds,
            'AP': ampm,
        };

    var replaceStr = '(' + Object.keys(replaceStrArray).join('|') + ')';
    var regex = new RegExp(replaceStr, 'g');

    ret = format.replace(regex, function (str) {
        return replaceStrArray[str];
    });

    return ret;
}

async function hiraganaInsert(req, res, vODPTValue1, vODPTValue2, vInboundWord, vOutputType, vInsertTarget) {
	await hiraganaAPI(vInboundWord, vOutputType)
		.then(function (convertedVal) {
			switch (vInsertTarget) {
			case "railway":
				execInsertRailway(req, res, vODPTValue2, convertedVal);
				break;
			case "station":
				execInsertStation(req, res, vODPTValue1, vODPTValue2, convertedVal);
				break;
			case "railDirection":
				execInsertRailDirection(req, res, vODPTValue2, convertedVal);
				break;
			}
		}).catch(function (err) {
			res.type("text/plain").status(500).send("ERROR in " + vInsertTarget + " for " + vODPTValue2 + " " + vInboundWord + ": " + err.toString());
		});
}

async function waitAllForHiraganaInsert(req, res, array, vInsertTarget) {
	switch (vInsertTarget) {
	case "railway":
	case "railDirection":
		await Promise.all(array.map(function (element) {
			return hiraganaInsert(req, res, 0, element["owl:sameAs"], element["dc:title"], "hiragana", vInsertTarget);
		}));
		await Promise.all(array.map(function (element) {
			return hiraganaInsert(req, res, 0, element["owl:sameAs"], element["dc:title"], "katakana", vInsertTarget);
		}));
		res.status(200).json(array.length + " x3 (original, hiragana and katakana) rows insert finished.");
		break;
	case "station":
		// return promise to use waitAllForHiraganaInsertWrapper.
		return new Promise(async function (resolve, reject) {
			await Promise.all(array.map(function (element) {
				return hiraganaInsert(req, res, element.ODPTRailway, element.ODPTStation, element.inboundStation, "hiragana", vInsertTarget);
			}));
			/*await Promise.all(array.map(function (element) {
				return hiraganaInsert(req, res, element.ODPTRailway, element.ODPTStation, element.inboundStation, "katakana", vInsertTarget);
			}));*/
			resolve(array.length);
		});
		break;
	}
}

async function sleep(milliseconds) {
	return new Promise(function (resolve, reject) {
		setTimeout(function () {
			resolve("sleeped for " + milliseconds + " milliseconds");
		}, milliseconds);
	});
}

// execute waitAllForHiraganaInsert with dividing the array by 100.
async function waitAllForHiraganaInsertWrapper(req, res, array, vInsertTarget) {
	for (var i = 0; i < Math.ceil(array.length / 100); i++) {
		var arrayPart = [];
		for (var j = 0; j < 100; j++) {
			if ((100 * i + j) === array.length) {
				break;
			}
			arrayPart.push(array[i * 100 + j]);
		}
		await waitAllForHiraganaInsert(req, res, arrayPart, "station")
			.then(function (promiseVal) {
				console.log(promiseVal);
			}).catch(function (err) {
				res.type("text/plain").status(500).send("ERROR in calling waitAllForHiraganaInsert from warpper: " + err.toString());
			});
		// execute every 3 seconds in order to avoid socket hang up error.
		await sleep(3000);
	}
	res.status(200).json(array);
}

/*　佐野さんオリジナルバージョン
app.post('/Inbound', function (req, res) {
	console.log("Hello!");
	var InRailway = req.body.conversation.memory.line.value;
	var InStation = req.body.conversation.memory.station.value;
	var InDirection = req.body.conversation.memory.direction.value;
	var InTime = req.body.conversation.memory.time.value;

	var sql = 'SELECT TOP 1 R."odptRailway", S."odptStation", RD."odptRailDirection" ' +
		'FROM "opd-test.opd-test-db::tables.Railway" R ' +
		'INNER JOIN "opd-test.opd-test-db::tables.Station" S ' +
		'ON R."odptRailway" = S."odptRailway" AND R."InboundWord" = \'' + InRailway +
		'\' AND S."InboundWord" = \'' + InStation +
		'\' INNER JOIN "opd-test.opd-test-db::tables.RailDirection" RD ' +
		'ON RD."InboundWord" = \'' + InDirection + '\'';
	req.db.prepare(sql, function (err, statement) {
		if (err) {
			res.type("text/plain").status(500).send("ERROR: " + err.toString());
		}
		//statement.exec([InRailway], function (err, STResult) {
		statement.exec([], function (err, STResult) {
			if (err) {
				res.type("text/plain").status(500).send("ERROR: " + err.toString());
			} else {
				//res.status(200).json(STResult);
				var aclConsumerKey = "8caf3415f50155f37dae1de42a80cab7a64f8770362649e07ba31ad0e475863e";
				var odptRailway = STResult[0].odptRailway;
				var odptStation = STResult[0].odptStation;
				var odptRailDirection = STResult[0].odptRailDirection;
				var odptCalendar = "odpt.Calendar:Weekday";
				var URL = "https://api-tokyochallenge.odpt.org/api/v4/odpt:StationTimetable" +
					"?acl:consumerKey=" + aclConsumerKey +
					"&odpt:railway=" + odptRailway +
					"&odpt:station=" + odptStation +
					"&odpt:railDirection=" + odptRailDirection +
					"&odpt:calendar=" + odptCalendar;

				https.get(URL, function (getRes) {
					var body = "";
					getRes.setEncoding('utf8');
					getRes.on('data', function (chunk) {
						body += chunk;
					});
					getRes.on('end', function () {
						var oBody = JSON.parse(body);
						var odptResult = oBody[0]["odpt:stationTimetableObject"];
						var departureTimes = "";
						odptResult.forEach(function (element) {
							if (element["odpt:departureTime"].indexOf(InTime + ":") !== -1) {
								departureTimes += (element["odpt:departureTime"]) + "、";
							}
						});
						var MY_TEXT = InTime + "時台の電車は、" + departureTimes + "がありまっせ。";
						var httpResponse = {
							"replies": [
								{
									"type": "text",
									"content": MY_TEXT
								}
							]
						};

						console.log(httpResponse);
						res.status(200).json(httpResponse);
					});
				}).on('error', function (err) {
					res.type("text/plain").status(500).send("ERROR: " + err.toString());
				});
			}
		});
	});
});
*/
app.post('/Itsumo', function(req,res) {
	try{
		console.log("いつもの機能がはじまるよ！");
		//RecastからくるIntimeとuser Name保存する変数を宣言
		var InSearchTerm = {
			InTime : req.body.conversation.memory.time.value,
			InUserName : req.body.conversation.participant_data.userName
			};
		/*SQLを投げてよく使う検索条件を取ってくる。とりあえずTOP1の結果だけ*/
		//SELECT TOP 1 "InRailway","InStationOn","InStationOff","InTime","InIsHoliday"
		//FROM "OPDTESTUSER"."opd-test.opd-test-db::tables.SearchHistory"
		//WHERE "UserName" = 'UserName';
		var sql_SearchItsumono = 'SELECT TOP 1 "InRailway","InStationOn","InStationOff","InIsHoliday",COUNT(*) as "CNT"'
								+ 'FROM "opd-test.opd-test-db::tables.SearchHistory"'
								+ 'WHERE "UserName"= hash_sha256(to_binary(\''+InSearchTerm.InUserName+'\'))'
								+ 'GROUP BY "InRailway","InStationOn","InStationOff","InIsHoliday" ORDER BY CNT DESC';

		//DBへSQLを投げて結果を返す
		req.db.exec(sql_SearchItsumono, function (err, results) {
			//DBなどの、何らかのエラーが発生した場合
			if (err) {
				console.log("ERROR: " + err.toString());
				throw ExceptionDatabasePrepError;
			}
			//クエリは実行できたけど、結果ががなかった場合のエラーハンドリング
			if(!results.length){
				var ErrorUnableGetItsumono = {
						category : "noResult",
						message: "履歴がないYO"
					};
				var httpResponse = {
						"replies": [
									{"type": "text","content": ErrorUnableGetItsumono.message}
									]
									};
				return;
			}
			//trace_levelは定義していないのでとりあえずコメントアウト↓
			//if(trace_level.Common >= 1){
			//	console.logs("何か入力エラーだのねん。");
			//	res.status(200).json(httpResponse);
			//	return;
			//}
			
			/*Recastに検索した条件で良いか返す*/
			//SQLでとってきた結果はどうやって変数としてしまう？->resultsオブジェクトに入ってくる
			console.log(results);
			//var MY_TEXT = "検索する条件は"+results[0].InRailway+"で"+results[0].InStationOn+"から"+results[0].InStationOff+"ゆきの"+results[0].InTime+"頃の"+results[0].InIsHoliday+"ダイヤの電車でよいですか？";
			//var httpResponse = {"replies": [
			//								{"type": "text","content": MY_TEXT}
			//							]
			//							};
			//console.log("HTTP Response:");
			//console.log(httpResponse);
			//res.status(200).json(httpResponse);
			
			//ココからInboundをコピーして,時刻表を返す
			var trace_level = {
			// ERROR = 0, INFO = 1, DEBUG = 2
			Common: 1,
			Direction : 1,
			GetTimetable : 1,
			Destination : 1
		};
			//まずInSearchTermにsql_SearchItsumonoで探してきた検索条件を入れる
			var InSearchTerm = {
			InRailway : results[0].InRailway,
			InStationOn : results[0].InStationOn,
			InStationOff : results[0].InStationOff,
			InTime : req.body.conversation.memory.time.value,
			InIsHoliday : results[0].InIsHoliday
		};
			/*平日・休日フラグをodptフォーマットに変換*/
			if(InSearchTerm.InIsHoliday == "休日"){
				InSearchTerm.InOdptCalendar = 'odpt.Calendar:SaturdayHoliday';
				} else {
						InSearchTerm.InOdptCalendar = 'odpt.Calendar:Weekday';
						};
				// InTimeの整形ロジック
			// Issue #15
			// 8時15分で来る場合 momentはHH:mm, HH, HHmm, HH時mm分のいづれも対応できていた。
			var InTimeFormatted = moment(InSearchTerm.InTime,'HH時mm分');
			var MaxTimeFormatted = moment(InSearchTerm.InTime,'HH時mm分').add(1,'hours');			
			
			//方面情報取得
			/*
			select TOP 1 "odptOperator","odptRailway","odptStationOn","odptStationOff","odptRailDirection"
			 from "opd-test.opd-test-db::zf_getDirection"('渋谷','九段下','半蔵門線');
			*/
			var sql_getDirection = 'SELECT TOP 1 "odptOperator","odptRailway","odptStationOn","odptStationOff","odptRailDirection"'
					+ 'from "opd-test.opd-test-db::zf_getDirection"'
					+ '(\''+InSearchTerm.InStationOn+'\',\''+InSearchTerm.InStationOff+'\',\''+InSearchTerm.InRailway+'\')';
			var oReq = req.db;
			req.db.prepare(sql_getDirection, function (err, statement) {
				if (err) {
					var ExceptionDatabasePrepError = {
						category : "dbError",
						message: "SQLのPREPAREでエラーがおきたよん: " + err.toString()
					};
					throw ExceptionDatabasePrepError;
				}
				statement.exec([], function (err, STResult) {
					if (err) {
						var ExceptionDatabaseExecError = {
							category : "dbError",
							message: "SQLの実行でエラーがおきたよん" + err.toString()
						};
	
						throw ExceptionDatabaseExecError;
					}
					if (!STResult.length ){
						//路線情報が取得できない(路線・駅名などが間違っている)
						var ErrorUnableGetRailway = {
							category : "noResult",
							message: "何か入力エラーだのねん。路線や駅名をもう一度確認してほしいのねん。"
						};
						var httpResponse = {
							"replies": [
								{
									"type": "text",
									"content": ErrorUnableGetRailway.message
								}
							]
						};
						if(trace_level.Common >= 1){
							console.logs("何か入力エラーだのねん。路線や駅名をもう一度確認してほしいのねん。");
						}
						res.status(200).json(httpResponse);
						return;
						//throw ErrorUnableGetRailway;　エラーになるのでとりあえず、正常終了としてエラーを返している
					}
	
					/*時刻表取得*/
					var paramApiStation = {
						aclConsumerKey		: "8caf3415f50155f37dae1de42a80cab7a64f8770362649e07ba31ad0e475863e",
						odptOperator		: STResult[0].odptOperator,
						odptRailway 		: STResult[0].odptRailway,
						odptStationOn 		: STResult[0].odptStationOn,
						odptStationOff 		: STResult[0].odptStationOff,
						odptRailDirection	: STResult[0].odptRailDirection,
						odptCalendar		: InSearchTerm.InOdptCalendar
					};
					
					//UserNameが入力されている場合のみ、履歴に登録
					if(InSearchTerm.UserName !== void 0){
						var sql_insertHistory = 'INSERT INTO "opd-test.opd-test-db::tables.SearchHistory" values('
												+'hash_sha256(to_binary(\''+InSearchTerm.UserName +'\')),'
												+'now(),'
												+'\''+InSearchTerm.InRailway +'\','
												+'\''+InSearchTerm.InStationOn +'\','
												+'\''+InSearchTerm.InStationOff +'\','
												+'\''+InSearchTerm.InTime +'\','
												+'\''+InSearchTerm.InIsHoliday +'\','
												+'\''+paramApiStation.odptOperator +'\','
												+'\''+paramApiStation.odptRailway +'\','
												+'\''+paramApiStation.odptStationOn +'\','
												+'\''+paramApiStation.odptStationOff +'\','
												+'\''+paramApiStation.odptRailDirection +'\','
												+'\''+paramApiStation.odptCalendar +'\''
												+')';
						req.db.exec(sql_insertHistory, function (err, results) {
							if (err) {
								console.log("ERROR: " + err.toString());
							}
						});
					};
					
					var URL_stationTimetable = "https://api-tokyochallenge.odpt.org/api/v4/odpt:StationTimetable" +
						"?acl:consumerKey=" + paramApiStation.aclConsumerKey +
						"&odpt:operator=" + paramApiStation.odptOperator +
						"&odpt:railway=" + paramApiStation.odptRailway +
						"&odpt:station=" + paramApiStation.odptStationOn +
						"&odpt:railDirection=" + paramApiStation.odptRailDirection +
						"&odpt:calendar=" + paramApiStation.odptCalendar;
	
					https.get(URL_stationTimetable, function (getRes) {
						var body = "";
						getRes.setEncoding('utf8');
						getRes.on('data', function (chunk) {
							body += chunk;
						});
	
						getRes.on('end', function () {
							var oBody = JSON.parse(body);
							if(!oBody[0]){
								console.log("Error: Cannot get Station Timetable with below URL;");
								console.log(URL_stationTimetable);
								var ErrorUnableGetAPI = {
									category : "apiError",
									message: "API StationTimetable からデータがとれなかったのねん"
								};
								var httpResponse = {
									"replies": [
										{
											"type": "text",
											"content": ErrorUnableGetAPI.message
										}
									]
								};
								res.status(200).json(httpResponse);
								return;
								//throw ErrorUnableGetAPI;　エラーになるのでとりあえず、正常終了としてエラーを返している
							}
							var odptResult = oBody[0]["odpt:stationTimetableObject"];
	
							/*取得した時刻表を時間で絞込み*/
							var TimeTables = [];
							var TimeTable = {};
							odptResult.forEach(function (element) {
								var departureTime = moment(element["odpt:departureTime"],"HH:mm");
								TimeTable = {
									odptDepatureTime		: element["odpt:departureTime"],
									odptTrain				: element["odpt:train"],
									odptTrainType			: element["odpt:trainType"],
									odptDestinationStation	: element["odpt:destinationStation"][0]
								};
								//console.log("Train:" + TimeTable.odptTrain);
								//console.log("InTime:" + InTimeFormatted.format("HH:mm") + " MaxTime:" + MaxTimeFormatted.format("HH:mm") + " trainTime:"+ departureTime.format("HH:mm"));
								if(departureTime.isBetween(InTimeFormatted,MaxTimeFormatted))
									TimeTables.push(TimeTable);
							});
							if(trace_level.Common >= 1){
								console.log("取得Train数: "+TimeTables.length);
							}
	
							/*Timetable 行先で絞込み*/
							var promise_timetables_dest = [];
							TimeTables.forEach(function (timetable){
	
								promise_timetables_dest.push(new Promise(function(resolve, reject){
	
									var URL_trainTimetable = "https://api-tokyochallenge.odpt.org/api/v4/odpt:TrainTimetable" +
										"?acl:consumerKey=" + paramApiStation.aclConsumerKey +
										"&odpt:operator=" + paramApiStation.odptOperator +
										"&odpt:calendar=" + paramApiStation.odptCalendar +
										"&odpt:train=" + timetable["odptTrain"];
									//console.log(URL_trainTimetable);
									https.get(URL_trainTimetable, function (getRes) {
										var body = "";
										getRes.setEncoding('utf8');
										getRes.on('data', function (chunk) {
											body += chunk;
										});
										getRes.on('end', function () {
											//console.log(body);
											var oBody = JSON.parse(body);
											if(!oBody[0]){
												console.log("Error: Cannot get Train Timetable with below URL;");
												console.log(URL_stationTimetable);
												var ErrorUnableGetAPI = {
													category : "apiError",
													message: "API TrainTimetable からデータがとれなかったのねん"
												};
												var httpResponse = {
													"replies": [
														{
															"type": "text",
															"content": ErrorUnableGetAPI.message
														}
													]
												};
												res.status(200).json(httpResponse);
												return;
												//throw ErrorUnableGetAPI;　エラーになるのでとりあえず、正常終了としてエラーを返している
											}
	
											var odptResult = oBody[0]["odpt:trainTimetableObject"];
											var is_stopped = false
	
											var promise_train = [];
											if(trace_level.Destination >=2){
														console.log("[DEBUG]"+timetable);
														console.log("[DEBUG]"+URL_trainTimetable);
											}
											odptResult.forEach(function (element) {
	
												if(element["odpt:departureStation"] == paramApiStation.odptStationOff){
													is_stopped = true;
													if(trace_level.Destination == 'DEBUG'){
														console.log("[DEBUG] Stopped");
													}
												}
												if(element["odpt:arrivalStation"] == paramApiStation.odptStationOff){
													is_stopped = true;
													if(trace_level.Destination >= 2){
														console.log("[DEBUG] Stopped");
													}
												}
												else{
													//console.log(timetable.odptDepatureTime+ "は止まらない");
												};
											});
											if(is_stopped == true){
												resolve(timetable);
											}else{
												if(trace_level.Destination >= 2){
													console.log("[DEBUG] NOT Stopped");
												}
												resolve("NS"); //降車駅に停まらない電車
											}
										});
									}).on('error', function (err) {
										res.type("text/plain").status(500).send("ERROR: " + err.toString());;
									});
								}));
							});
	
							Promise.all(promise_timetables_dest).then(function(TimeTables_dest){
								/*タイプ(Express->急行, Local->普通)変換*/
								var promise_timetables_type = [];
								if(trace_level.Common >= 1){
									console.log("取得Train数(Dest): "+TimeTables_dest.length);
								}
								TimeTables_dest.forEach(function(timetable){
									if(timetable != "NS"){ //停車する駅のみを対象とする
										promise_timetables_type.push(new Promise(function(resolve, reject){
											var URL = "https://api-tokyochallenge.odpt.org/api/v4/odpt:TrainType" +
												"?acl:consumerKey=" + paramApiStation.aclConsumerKey +
												"&odpt:operator=" + paramApiStation.odptOperator +
												"&owl:sameAs=" + timetable["odptTrainType"];
											https.get(URL, function (getRes) {
												var body = "";
												getRes.setEncoding('utf8');
												getRes.on('data', function (chunk) {
													body += chunk;
												});
												getRes.on('end', function () {
													var oBody = JSON.parse(body);
													//console.log(body);
													timetable.typeTitle = oBody[0]["dc:title"];
	
	
													//終着駅の行先日本語名を取得
													//メモ：Stationテーブルをひらがな対応で一意にならない場合に
													//Stationtテーブルで正かあいまい対応なのか判別させる不具合が必要(テーブルにAPIから取得したレコードについてはフラグを立てる？)
													//SELECT TOP 1 "InboundWord" as "Destination" FROM "opd-test.opd-test-db::tables.Station" WHERE "odptStation" ='odpt.Station:TokyoMetro.Hanzomon.Kudanshita'
													var sql_getDestination = 'SELECT TOP 1 "InboundWord" as "Destination" FROM "opd-test.opd-test-db::tables.Station" '
														+ 'WHERE "odptStation"=\'' + timetable["odptDestinationStation"] + '\''
														+ 'AND "TextType" = 0';
													req.db.prepare(sql_getDestination, function (err, statement) {
														if (err) {
															throw "PREPAREで何かDBエラーだよ" + err.toString();
														}
														statement.exec([], function (err, STResult) {
															if (err) {
																throw "PREPAREで何かDBエラーだよ" + err.toString();
															}
															if (STResult.length ){
																timetable.odptDestinationStationTXT = STResult[0].Destination;
															}
														resolve(timetable);
														});
													});
												});
											}).on('error', function (err) {
												res.type("text/plain").status(500).send("ERROR: " + err.toString());;
											});
										}));
									};
								});
	
								Promise.all(promise_timetables_type).then(function(TimeTables_type){
									/*時刻でソート*/
									TimeTables_type.sort(sort_by('odptDepatureTime', false, function(a){return a.toUpperCase()}));
	
									var timeTableTXT = "";
									for(var trainNum = 0; trainNum < TimeTables_type.length ; trainNum++){
										if(trainNum===10){
											break;
										}
										timeTableTXT += TimeTables_type[trainNum].odptDepatureTime + " " + TimeTables_type[trainNum].typeTitle + " " + TimeTables_type[trainNum].odptDestinationStationTXT + "行\n";
									};
									if (TimeTables_type.length === 0){
										var MY_TEXT = InTimeFormatted.format("HH時mm分") + "から1時間内には電車が見つからなかったのねん。";
									}else{
										//var MY_TEXT = "いつも検索してる、"+InSearchTerm.InRailway+"の"+InSearchTerm.InStationOn+"から"+InSearchTerm.InStationOff+"行きの"+InSearchTerm.InIsHoliday+"ダイヤで"+InTimeFormatted.format("HH時mm分") + "から"+(trainNum)+"本の電車は、\n" + timeTableTXT + "があるよん。\nデータ取得日時(" + (new Date()).toString() + ")";
										var MY_TEXT = "いつも検索してる、"+InSearchTerm.InRailway+"の"+InSearchTerm.InStationOn+"から"+InSearchTerm.InStationOff+"行きの"+InSearchTerm.InIsHoliday+"ダイヤで"+InTimeFormatted.format("HH時mm分") + "から"+(trainNum)+"本の電車は、\n" + timeTableTXT + "があるよん。\nデータ取得日時(" + datetostr(new Date(), 'Y年MM月DD日(WW) AP hh:mm:ss (JST)', true) + ")";
									}
									var httpResponse = {
										"replies": [
											{
												"type": "text",
												"content": MY_TEXT
											}
										]
									};
									console.log("HTTP Response:");
									console.log(httpResponse);
									res.status(200).json(httpResponse);
								})
							});
						});
					}).on('error', function (err) {
						res.type("text/plain").status(500).send("ERROR: " + err.toString());
					});
				});
			});
		
			//最後のカッコ↓	
			});
		}
	catch(e){
			console.log(e);
		if(e.category == "noResult"){
			var httpResponse = {
				"replies": [
					{
						"type": "text",
						"content": e.message
					}
				]
			};
			res.status(200).json(httpResponse);
		}
		else{
			res.type("text/plain").status(500).send(e.message);
		}
	}
});

app.post('/Inbound', function (req, res) {
	try{
		console.log("Hello inbound!");
		console.log("body:"+JSON.stringify(req.body));

		var trace_level = {
			// ERROR = 0, INFO = 1, DEBUG = 2
			Common: 1,
			Direction : 1,
			GetTimetable : 1,
			Destination : 1
		};

		var InSearchTerm = {
			InRailway : req.body.conversation.memory.line.value,
			InStationOn : req.body.conversation.memory.stationOn.value,
			InStationOff : req.body.conversation.memory.stationOff.value,
			InTime : req.body.conversation.memory.time.value,
			InIsHoliday : req.body.conversation.memory.isHoliday.value
		};
		
		if(req.body.conversation.participant_data.userName !== void 0){
			InSearchTerm.UserName = req.body.conversation.participant_data.userName;
		};

		if(trace_level.Common >= 1){
			console.log("[logs] Railway:" + InSearchTerm.InRailway + ", StationOn: " + InSearchTerm.InStationOn + ", StationOff: " + InSearchTerm.InStationOff + ", Time: " + InSearchTerm.InTime + ", IsHoliday: " + InSearchTerm.InIsHoliday);
		}

		/*平日・休日フラグをodptフォーマットに変換*/
		if(InSearchTerm.InIsHoliday == "休日"){
			InSearchTerm.InOdptCalendar = 'odpt.Calendar:SaturdayHoliday';
		} else {
			InSearchTerm.InOdptCalendar = 'odpt.Calendar:Weekday';
		};

		// InTimeの整形ロジック
		// Issue #15
		// 8時15分で来る場合 momentはHH:mm, HH, HHmm, HH時mm分のいづれも対応できていた。
		var InTimeFormatted = moment(InSearchTerm.InTime,'HH時mm分');
		var MaxTimeFormatted = moment(InSearchTerm.InTime,'HH時mm分').add(1,'hours');

		//方面情報取得
		/*
		select TOP 1 "odptOperator","odptRailway","odptStationOn","odptStationOff","odptRailDirection"
		 from "opd-test.opd-test-db::zf_getDirection"('渋谷','九段下','半蔵門線');
		*/
		var sql_getDirection = 'SELECT TOP 1 "odptOperator","odptRailway","odptStationOn","odptStationOff","odptRailDirection"'
				+ 'from "opd-test.opd-test-db::zf_getDirection"'
				+ '(\''+InSearchTerm.InStationOn+'\',\''+InSearchTerm.InStationOff+'\',\''+InSearchTerm.InRailway+'\')';
		req.db.prepare(sql_getDirection, function (err, statement) {
			if (err) {
				var ExceptionDatabasePrepError = {
					category : "dbError",
					message: "SQLのPREPAREでエラーがおきたよん: " + err.toString()
				};
				throw ExceptionDatabasePrepError;
			}
			statement.exec([], function (err, STResult) {
				if (err) {
					var ExceptionDatabaseExecError = {
						category : "dbError",
						message: "SQLの実行でエラーがおきたよん" + err.toString()
					};

					throw ExceptionDatabaseExecError;
				}
				if (!STResult.length ){
					//路線情報が取得できない(路線・駅名などが間違っている)
					var ErrorUnableGetRailway = {
						category : "noResult",
						message: "何か入力エラーだのねん。路線や駅名をもう一度確認してほしいのねん。"
					};
					var httpResponse = {
						"replies": [
							{
								"type": "text",
								"content": ErrorUnableGetRailway.message
							}
						]
					};
					if(trace_level.Common >= 1){
						console.log("何か入力エラーだのねん。路線や駅名をもう一度確認してほしいのねん。");
					}
					res.status(200).json(httpResponse);
					return;
					//throw ErrorUnableGetRailway;　エラーになるのでとりあえず、正常終了としてエラーを返している
				}

				/*時刻表取得*/
				var paramApiStation = {
					aclConsumerKey		: "8caf3415f50155f37dae1de42a80cab7a64f8770362649e07ba31ad0e475863e",
					odptOperator		: STResult[0].odptOperator,
					odptRailway 		: STResult[0].odptRailway,
					odptStationOn 		: STResult[0].odptStationOn,
					odptStationOff 		: STResult[0].odptStationOff,
					odptRailDirection	: STResult[0].odptRailDirection,
					odptCalendar		: InSearchTerm.InOdptCalendar
				};
				
				//UserNameが入力されている場合のみ、履歴に登録
				if(InSearchTerm.UserName !== void 0){
					var sql_insertHistory = 'INSERT INTO "opd-test.opd-test-db::tables.SearchHistory" values('
											+'hash_sha256(to_binary(\''+InSearchTerm.UserName +'\')),'
											+'now(),'
											+'\''+InSearchTerm.InRailway +'\','
											+'\''+InSearchTerm.InStationOn +'\','
											+'\''+InSearchTerm.InStationOff +'\','
											+'\''+InSearchTerm.InTime +'\','
											+'\''+InSearchTerm.InIsHoliday +'\','
											+'\''+paramApiStation.odptOperator +'\','
											+'\''+paramApiStation.odptRailway +'\','
											+'\''+paramApiStation.odptStationOn +'\','
											+'\''+paramApiStation.odptStationOff +'\','
											+'\''+paramApiStation.odptRailDirection +'\','
											+'\''+paramApiStation.odptCalendar +'\''
											+')';
					req.db.exec(sql_insertHistory, function (err, results) {
						if (err) {
							console.log("ERROR: " + err.toString());
						}
					});
				};
				
				var URL_stationTimetable = "https://api-tokyochallenge.odpt.org/api/v4/odpt:StationTimetable" +
					"?acl:consumerKey=" + paramApiStation.aclConsumerKey +
					"&odpt:operator=" + paramApiStation.odptOperator +
					"&odpt:railway=" + paramApiStation.odptRailway +
					"&odpt:station=" + paramApiStation.odptStationOn +
					"&odpt:railDirection=" + paramApiStation.odptRailDirection +
					"&odpt:calendar=" + paramApiStation.odptCalendar;

				https.get(URL_stationTimetable, function (getRes) {
					var body = "";
					getRes.setEncoding('utf8');
					getRes.on('data', function (chunk) {
						body += chunk;
					});

					getRes.on('end', function () {
						var oBody = JSON.parse(body);
						if(!oBody[0]){
							console.log("Error: Cannot get Station Timetable with below URL;");
							console.log(URL_stationTimetable);
							var ErrorUnableGetAPI = {
								category : "apiError",
								message: "API StationTimetable からデータがとれなかったのねん"
							};
							var httpResponse = {
								"replies": [
									{
										"type": "text",
										"content": ErrorUnableGetAPI.message
									}
								]
							};
							res.status(200).json(httpResponse);
							return;
							//throw ErrorUnableGetAPI;　エラーになるのでとりあえず、正常終了としてエラーを返している
						}
						var odptResult = oBody[0]["odpt:stationTimetableObject"];

						/*取得した時刻表を時間で絞込み*/
						var TimeTables = [];
						var TimeTable = {};
						odptResult.forEach(function (element) {
							var departureTime = moment(element["odpt:departureTime"],"HH:mm");
							TimeTable = {
								odptDepatureTime		: element["odpt:departureTime"],
								odptTrain				: element["odpt:train"],
								odptTrainType			: element["odpt:trainType"],
								odptDestinationStation	: element["odpt:destinationStation"][0]
							};
							//console.log("Train:" + TimeTable.odptTrain);
							//console.log("InTime:" + InTimeFormatted.format("HH:mm") + " MaxTime:" + MaxTimeFormatted.format("HH:mm") + " trainTime:"+ departureTime.format("HH:mm"));
							if(departureTime.isBetween(InTimeFormatted,MaxTimeFormatted))
								TimeTables.push(TimeTable);
						});
						if(trace_level.Common >= 1){
							console.log("取得Train数: "+TimeTables.length);
						}

						/*Timetable 行先で絞込み*/
						var promise_timetables_dest = [];
						TimeTables.forEach(function (timetable){

							promise_timetables_dest.push(new Promise(function(resolve, reject){

								var URL_trainTimetable = "https://api-tokyochallenge.odpt.org/api/v4/odpt:TrainTimetable" +
									"?acl:consumerKey=" + paramApiStation.aclConsumerKey +
									"&odpt:operator=" + paramApiStation.odptOperator +
									"&odpt:calendar=" + paramApiStation.odptCalendar +
									"&odpt:train=" + timetable["odptTrain"];
								//console.log(URL_trainTimetable);
								https.get(URL_trainTimetable, function (getRes) {
									var body = "";
									getRes.setEncoding('utf8');
									getRes.on('data', function (chunk) {
										body += chunk;
									});
									getRes.on('end', function () {
										//console.log(body);
										var oBody = JSON.parse(body);
										if(!oBody[0]){
											console.log("Error: Cannot get Train Timetable with below URL;");
											console.log(URL_stationTimetable);
											var ErrorUnableGetAPI = {
												category : "apiError",
												message: "API TrainTimetable からデータがとれなかったのねん"
											};
											var httpResponse = {
												"replies": [
													{
														"type": "text",
														"content": ErrorUnableGetAPI.message
													}
												]
											};
											res.status(200).json(httpResponse);
											return;
											//throw ErrorUnableGetAPI;　エラーになるのでとりあえず、正常終了としてエラーを返している
										}

										var odptResult = oBody[0]["odpt:trainTimetableObject"];
										var is_stopped = false

										var promise_train = [];
										if(trace_level.Destination >=2){
													console.log("[DEBUG]"+timetable);
													console.log("[DEBUG]"+URL_trainTimetable);
										}
										odptResult.forEach(function (element) {

											if(element["odpt:departureStation"] == paramApiStation.odptStationOff){
												is_stopped = true;
												if(trace_level.Destination == 'DEBUG'){
													console.log("[DEBUG] Stopped");
												}
											}
											if(element["odpt:arrivalStation"] == paramApiStation.odptStationOff){
												is_stopped = true;
												if(trace_level.Destination >= 2){
													console.log("[DEBUG] Stopped");
												}
											}
											else{
												//console.log(timetable.odptDepatureTime+ "は止まらない");
											};
										});
										if(is_stopped == true){
											resolve(timetable);
										}else{
											if(trace_level.Destination >= 2){
												console.log("[DEBUG] NOT Stopped");
											}
											resolve("NS"); //降車駅に停まらない電車
										}
									});
								}).on('error', function (err) {
									res.type("text/plain").status(500).send("ERROR: " + err.toString());;
								});
							}));
						});

						Promise.all(promise_timetables_dest).then(function(TimeTables_dest){
							/*タイプ(Express->急行, Local->普通)変換*/
							var promise_timetables_type = [];
							if(trace_level.Common >= 1){
								console.log("取得Train数(Dest): "+TimeTables_dest.length);
							}
							TimeTables_dest.forEach(function(timetable){
								if(timetable != "NS"){ //停車する駅のみを対象とする
									promise_timetables_type.push(new Promise(function(resolve, reject){
										var URL = "https://api-tokyochallenge.odpt.org/api/v4/odpt:TrainType" +
											"?acl:consumerKey=" + paramApiStation.aclConsumerKey +
											"&odpt:operator=" + paramApiStation.odptOperator +
											"&owl:sameAs=" + timetable["odptTrainType"];
										https.get(URL, function (getRes) {
											var body = "";
											getRes.setEncoding('utf8');
											getRes.on('data', function (chunk) {
												body += chunk;
											});
											getRes.on('end', function () {
												var oBody = JSON.parse(body);
												//console.log(body);
												timetable.typeTitle = oBody[0]["dc:title"];


												//終着駅の行先日本語名を取得
												//メモ：Stationテーブルをひらがな対応で一意にならない場合に
												//Stationtテーブルで正かあいまい対応なのか判別させる不具合が必要(テーブルにAPIから取得したレコードについてはフラグを立てる？)
												//SELECT TOP 1 "InboundWord" as "Destination" FROM "opd-test.opd-test-db::tables.Station" WHERE "odptStation" ='odpt.Station:TokyoMetro.Hanzomon.Kudanshita'
												var sql_getDestination = 'SELECT TOP 1 "InboundWord" as "Destination" FROM "opd-test.opd-test-db::tables.Station" '
													+ 'WHERE "odptStation"=\'' + timetable["odptDestinationStation"] + '\''
													+ 'AND "TextType" = 0';
												req.db.prepare(sql_getDestination, function (err, statement) {
													if (err) {
														throw "PREPAREで何かDBエラーだよ" + err.toString();
													}
													statement.exec([], function (err, STResult) {
														if (err) {
															throw "PREPAREで何かDBエラーだよ" + err.toString();
														}
														if (STResult.length ){
															timetable.odptDestinationStationTXT = STResult[0].Destination;
														}
													resolve(timetable);
													});
												});
											});
										}).on('error', function (err) {
											res.type("text/plain").status(500).send("ERROR: " + err.toString());;
										});
									}));
								};
							});

							Promise.all(promise_timetables_type).then(function(TimeTables_type){
								/*時刻でソート*/
								TimeTables_type.sort(sort_by('odptDepatureTime', false, function(a){return a.toUpperCase()}));

								var timeTableTXT = "";
								for(var trainNum = 0; trainNum < TimeTables_type.length ; trainNum++){
									if(trainNum===10){
										break;
									}
									timeTableTXT += TimeTables_type[trainNum].odptDepatureTime + " " + TimeTables_type[trainNum].typeTitle + " " + TimeTables_type[trainNum].odptDestinationStationTXT + "行\n";
								};
								if (TimeTables_type.length === 0){
									var MY_TEXT = InTimeFormatted.format("HH時mm分") + "から1時間内には電車が見つからなかったのねん。";
								}else{
									//var MY_TEXT = InTimeFormatted.format("HH時mm分") + "から"+(trainNum)+"本の電車は、\n" + timeTableTXT + "があるよん。 \nデータ取得日時(" + (new Date()).toString() + ")";
									var MY_TEXT =InSearchTerm.InRailway+"の"+InSearchTerm.InStationOn+"から"+InSearchTerm.InStationOff+"行きの"+InSearchTerm.InIsHoliday+"ダイヤで"+InTimeFormatted.format("HH時mm分") + "から"+(trainNum)+"本の電車は、\n" + timeTableTXT + "があるよん。 \nデータ取得日時(" + datetostr(new Date(), 'Y年MM月DD日(WW) AP hh:mm:ss (JST)', true) + ")";
								}
								var httpResponse = {
									"replies": [
										{
											"type": "text",
											"content": MY_TEXT
										}
									]
								};
								console.log("HTTP Response:");
								console.log(httpResponse);
								res.status(200).json(httpResponse);
							})
						});
					});
				}).on('error', function (err) {
					res.type("text/plain").status(500).send("ERROR: " + err.toString());
				});
			});
		});
	}
	catch(e){
		console.log(e);
		if(e.category == "noResult"){
			var httpResponse = {
				"replies": [
					{
						"type": "text",
						"content": e.message
					}
				]
			};
			res.status(200).json(httpResponse);
		}
		else{
			res.type("text/plain").status(500).send(e.message);
		}
	}
});


app.get('/insertOperator',function(req,res){
	var sql_truncate = 'truncate table "opd-test.opd-test-db::tables.Operator"';
	req.db.exec(sql_truncate, function (err, results) {
		if (err) {
			console.log("ERROR: " + err.toString());
			res.type("text/plain").status(500).send("Update Operator table is failed during truncate");
			return;
		}

		var URL = 
//			"https://api-tokyochallenge.odpt.org/api/v4/odpt:Operator.json?acl:consumerKey=8caf3415f50155f37dae1de42a80cab7a64f8770362649e07ba31ad0e475863e";
			"https://api-tokyochallenge.odpt.org/api/v4/odpt:Operator?acl:consumerKey=8caf3415f50155f37dae1de42a80cab7a64f8770362649e07ba31ad0e475863e";
		
		https.get(URL, function (getRes) {
			var body = "";
			getRes.setEncoding('utf8');
			getRes.on('data', function (chunk) {
				body += chunk;
			});
			getRes.on('end', function () {
				var oBody = JSON.parse(body);
				oBody.forEach(function (eleOperator) {
					execInsertOperator(req, res, eleOperator["owl:sameAs"], eleOperator["dc:title"]);
				});
				res.type("text/plain").status(500).send("Update Operator table is triggered succeffully.");
			});
		}).on('error', function (err) {
			console.log("ERROR: " + err.toString());
			res.type("text/plain").status(500).send("Update Operator table is failed during API access");
		});
	});
});


app.get('/insertRailway', function (req, res) {
	try{
		var sql_truncate = 'truncate table "opd-test.opd-test-db::tables.Railway"';
		req.db.exec(sql_truncate, function (err, results) {
			if (err) {
				var ErrorDBTruncateFailed = {
					category: "DB",
					message: "ERROR: " + err.toString()
				};
				throw ErrorDBTruncateFailed;
			}	
		
			var URL =
				"https://api-tokyochallenge.odpt.org/api/v4/odpt:Railway?acl:consumerKey=8caf3415f50155f37dae1de42a80cab7a64f8770362649e07ba31ad0e475863e";
		
			https.get(URL, function (getRes) {
				var body = "";
				getRes.setEncoding('utf8');
				getRes.on('data', function (chunk) {
					body += chunk;
				});
				getRes.on('end', function () {
					var oBody = JSON.parse(body);
					oBody.forEach(function (eleRailway) {
						var sql = 'SELECT TOP 1 "OperatorTitle" FROM "opd-test.opd-test-db::tables.Operator" ' 
									+ 'WHERE "odptOperator" = \'' + eleRailway["odpt:operator"] +'\'';
						//console.log("//////////////before prepare");
						//console.log(req.db);
						oReqDB = req.db;
						req.db.prepare(sql, function (err, statement) {
							//console.log("//////////////////////req just after prepare");
							req.db = oReqDB;
							//console.log(req.db);
							if (err) {
								var ErrorDBPrepareFailed = {
									category: "DB",
									message: "ERROR: " + err.toString()
								};
								throw ErrorDBPrepareFailed;
							}
							statement.exec([], function (err, STResult) {
								var operatorTitle = "";
								if (err) {
									var ErrorDBExecFailed = {
										category: "DB",
										message: "ERROR: " + err.toString()
									};
									throw ErrorDBExecFailed;
								}
								if (STResult.length ){
									operatorTitle = STResult[0].OperatorTitle;
								}
								execInsertRailway(req, res, eleRailway["owl:sameAs"], eleRailway["dc:title"],eleRailway["odpt:operator"],operatorTitle,eleRailway["odpt:stationOrder"]);
							});	
						});
					});
					//waitAllForHiraganaInsert(req, res, oBody, "railway");
					res.type("text/plain").status(500).send("Update Railway table is triggered succeffully.");
				});
			}).on('error', function (err) {
				res.type("text/plain").status(500).send("ERROR: " + err.toString());
			});
		});
	}
	catch(e){
		console.log(e);
		if(e.category == "noResult"){
			var httpResponse = {
				"replies": [
					{
						"type": "text",
						"content": e.message
					}
				]
			};
			res.status(200).json(httpResponse);
		}
		else{
			res.type("text/plain").status(500).send(e.message);
		}
	}
});

app.get('/insertStation', function (req, res) {
	var URL =
		"https://api-tokyochallenge.odpt.org/api/v4/odpt:Railway?acl:consumerKey=8caf3415f50155f37dae1de42a80cab7a64f8770362649e07ba31ad0e475863e";

	https.get(URL, function (getRes) {
		var body = "";
		getRes.setEncoding('utf8');
		getRes.on('data', function (chunk) {
			body += chunk;
		});
		getRes.on('end', function () {
			var oBody = JSON.parse(body);
			var dataArray = [];
			oBody.forEach(function (eleRailway) {
				eleRailway["odpt:stationOrder"].forEach(function (eleStation) {
					execInsertStation(req, res, eleRailway["owl:sameAs"], eleStation["odpt:station"], eleStation["odpt:stationTitle"].ja);
					var data = {
						"ODPTRailway": eleRailway["owl:sameAs"],
						"ODPTStation": eleStation["odpt:station"],
						"inboundStation": eleStation["odpt:stationTitle"].ja
					};
					dataArray.push(data);
				});
			});
			// Use wrapper function to devide the array, otherwise end up socket hang up error.
			waitAllForHiraganaInsertWrapper(req, res, dataArray, "railDirection");
		});
	}).on('error', function (err) {
		res.type("text/plain").status(500).send("ERROR: " + err.toString());
	});
});

app.get('/insertRailDirection', function (req, res) {
	var URL =
		"https://api-tokyochallenge.odpt.org/api/v4/odpt:RailDirection?acl:consumerKey=8caf3415f50155f37dae1de42a80cab7a64f8770362649e07ba31ad0e475863e";

	https.get(URL, function (getRes) {
		var body = "";
		getRes.setEncoding('utf8');
		getRes.on('data', function (chunk) {
			body += chunk;
		});
		getRes.on('end', function () {
			var oBody = JSON.parse(body);
			oBody.forEach(function (element) {
				execInsertRailDirection(req, res, element["owl:sameAs"], element["dc:title"]);
			});
			waitAllForHiraganaInsert(req, res, oBody, "railDirection");
		});
	}).on('error', function (err) {
		res.type("text/plain").status(500).send("ERROR: " + err.toString());
	});
});

app.get('/hiraganaAPITest', function (req, res) {
	var testArray = [0, 1, 2];
	var resultArray = [];
	testArray.forEach(function (element) {
		hiraganaAPI("漢字", "hiragana", function (apiRes, apiErr) {
			if (apiErr) {
				res.type("text/plain").status(500).send("ERROR: " + apiErr.toString());
			}
			resultArray.push(apiRes.data.converted);
		});
	});
	res.status(200).json(resultArray);
});
