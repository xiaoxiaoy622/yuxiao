(function () {
    'use strict';

    var _origSetTimeout = window.setTimeout;
    var _origClearTimeout = window.clearTimeout;
    var _origSetInterval = window.setInterval;
    var _origClearInterval = window.clearInterval;
    var _origDate = window.Date;
    var _origDateNow = _origDate.now.bind ? _origDate.now.bind(_origDate) : function () { return _origDate.now(); };
    var _origDateParse = _origDate.parse;
    var _origDateUTC = _origDate.UTC;

    var _percentage = 1.0;
    var _invPercentage = 1.0;
    var _timeoutIds = {};
    var _intervalIds = {};
    var _autoUniqueId = 1;
    var _hooksInstalled = false;

    var _lastRealTime = _origDateNow();
    var _lastVirtualTime = _origDateNow();

    function genUniqueId() { return _autoUniqueId++; }

    function notifyExec(uniqueId) {
        if (!uniqueId) return;
        for (var id in _timeoutIds) {
            var info = _timeoutIds[id];
            if (info.uniqueId === uniqueId) {
                _origClearTimeout.call(window, info.nowId);
                delete _timeoutIds[info.originId];
                break;
            }
        }
    }

    function hookedSetTimeout() {
        var uniqueId = genUniqueId();
        var callback = arguments[0];
        if (typeof callback === 'function') {
            var _cb = callback;
            arguments[0] = function () {
                var ret = _cb.apply(this, arguments);
                notifyExec(uniqueId);
                return ret;
            };
        }
        var originMS = arguments[1];
        arguments[1] = (originMS || 0) * _percentage;
        var resultId = _origSetTimeout.apply(window, arguments);
        _timeoutIds[resultId] = {
            args: arguments, originMS: originMS, originId: resultId,
            nowId: resultId, uniqueId: uniqueId, oldPercentage: _percentage,
            exceptNextFireTime: _origDateNow() + (originMS || 0)
        };
        return resultId;
    }

    function hookedSetInterval() {
        var uniqueId = genUniqueId();
        var callback = arguments[0];
        if (typeof callback === 'function') {
            var _cb = callback;
            arguments[0] = function () {
                var ret = _cb.apply(this, arguments);
                notifyExec(uniqueId);
                return ret;
            };
        }
        var originMS = arguments[1];
        arguments[1] = (originMS || 0) * _percentage;
        var resultId = _origSetInterval.apply(window, arguments);
        _intervalIds[resultId] = {
            args: arguments, originMS: originMS, originId: resultId,
            nowId: resultId, uniqueId: uniqueId, oldPercentage: _percentage,
            exceptNextFireTime: _origDateNow() + (originMS || 0)
        };
        return resultId;
    }

    function hookedClearTimeout() {
        var id = arguments[0];
        if (_timeoutIds[id]) { arguments[0] = _timeoutIds[id].nowId; delete _timeoutIds[id]; }
        return _origClearTimeout.apply(window, arguments);
    }

    function hookedClearInterval() {
        var id = arguments[0];
        if (_intervalIds[id]) { arguments[0] = _intervalIds[id].nowId; delete _intervalIds[id]; }
        return _origClearInterval.apply(window, arguments);
    }

    function percentageChangeHandler(newPercentage) {
        var now = _origDateNow();
        var intKeys = Object.keys(_intervalIds);
        for (var i = 0; i < intKeys.length; i++) {
            var idObj = _intervalIds[intKeys[i]];
            idObj.args[1] = Math.floor((idObj.originMS || 1) * newPercentage);
            _origClearInterval.call(window, idObj.nowId);
            idObj.nowId = _origSetInterval.apply(window, idObj.args);
        }
        var toutKeys = Object.keys(_timeoutIds);
        for (var j = 0; j < toutKeys.length; j++) {
            var idObj2 = _timeoutIds[toutKeys[j]];
            var exceptTime = idObj2.exceptNextFireTime;
            var oldPercentage = idObj2.oldPercentage;
            var time = exceptTime - now;
            if (time < 0) time = 0;
            var changedTime = Math.floor(newPercentage / oldPercentage * time);
            idObj2.args[1] = changedTime;
            idObj2.exceptNextFireTime = now + changedTime;
            idObj2.oldPercentage = newPercentage;
            _origClearTimeout.call(window, idObj2.nowId);
            idObj2.nowId = _origSetTimeout.apply(window, idObj2.args);
        }
    }

    function _HookedDate() {
        var n = arguments.length;
        if (n === 0) return new _origDate(Date.now());
        if (n === 1) return new _origDate(arguments[0]);
        if (n === 2) return new _origDate(arguments[0], arguments[1]);
        if (n === 3) return new _origDate(arguments[0], arguments[1], arguments[2]);
        if (n === 4) return new _origDate(arguments[0], arguments[1], arguments[2], arguments[3]);
        if (n === 5) return new _origDate(arguments[0], arguments[1], arguments[2], arguments[3], arguments[4]);
        if (n === 6) return new _origDate(arguments[0], arguments[1], arguments[2], arguments[3], arguments[4], arguments[5]);
        return new _origDate(arguments[0], arguments[1], arguments[2], arguments[3], arguments[4], arguments[5], arguments[6]);
    }

    function _hookedDateNow() {
        var realNow = _origDateNow();
        return _lastVirtualTime + (realNow - _lastRealTime) * _invPercentage;
    }

    function installHooks() {
        if (_hooksInstalled) return;
        _hooksInstalled = true;
        window.setTimeout = hookedSetTimeout;
        window.setInterval = hookedSetInterval;
        window.clearTimeout = hookedClearTimeout;
        window.clearInterval = hookedClearInterval;
        window.Date = _HookedDate;
        _HookedDate.now = _hookedDateNow;
        _HookedDate.parse = _origDateParse;
        _HookedDate.UTC = _origDateUTC;
    }

    function removeHooks() {
        if (!_hooksInstalled) return;
        _hooksInstalled = false;
        window.setTimeout = _origSetTimeout;
        window.setInterval = _origSetInterval;
        window.clearTimeout = _origClearTimeout;
        window.clearInterval = _origClearInterval;
        window.Date = _origDate;
        _intervalIds = {};
        _timeoutIds = {};
    }

    function _applySpeed(speed) {
        var realNow = _origDateNow();
        if (speed === 1) {
            _lastVirtualTime = _hookedDateNow();
            _lastRealTime = realNow;
            _percentage = 1.0;
            _invPercentage = 1.0;
            percentageChangeHandler(1.0);
            return;
        }
        installHooks();
        _lastVirtualTime = _hookedDateNow();
        _lastRealTime = realNow;
        var newPercentage = 1 / speed;
        percentageChangeHandler(newPercentage);
        _percentage = newPercentage;
        _invPercentage = speed;
    }

    window.$hookTimer = {
        setSpeed: function (speed) {
            if (typeof speed !== 'number' || speed <= 0) return;
            _applySpeed(speed);
        },
        getSpeed: function () { return 1 / _percentage; },
        getPercentage: function () { return _percentage; }
    };

    // ===================== 玉箫 UI =====================
    var _jsq_value = 1;
    var _isPersistent = false;
    var _xiaoOffX = 0, _xiaoOffY = 0;

    var _cssText = [
        ':root{--ink-deep:#1a1a1a;--ink-mid:#3a3a3a;--ink-light:#5a5a5a;--bamboo-dark:#1a3a5c;--bamboo-mid:#2a5a8c;--bamboo-light:#4a9acc;--jade:#4ac0f0;--jade-light:#80d8ff;--paper:#f5f0e6;--paper-dark:#e8e0d0;--red-seal:#c3272b}',
        /* === PC默认（紧凑型） === */
        '#xiao-trigger{position:fixed;top:50%;left:12px;transform:translateY(-50%);z-index:2147483647;width:clamp(48px,7vh,72px);height:clamp(124px,18vh,198px);cursor:grab;user-select:none;touch-action:none;transition:transform .3s ease,opacity .3s ease}',
        '#xiao-trigger:hover{transform:translateY(-50%) scale(1.05)}',
        '#xiao-trigger.fast .xiao-img{animation:xiaoImgBreath 2.2s ease-in-out infinite}',
        '@keyframes xiaoImgBreath{0%,100%{filter:url(#chromaKey) drop-shadow(0 0 6px rgba(74,156,204,.35))}50%{filter:url(#chromaKey) drop-shadow(0 0 16px rgba(74,204,240,.85))}}',
        '#xiao-trigger.scrolled{opacity:.35;transform:translateY(-50%) scale(.92)}',
        '#xiao-trigger .xiao-img{width:100%;height:100%;display:block;object-fit:cover;border-radius:6px;background:transparent !important;pointer-events:none;filter:url(#chromaKey) drop-shadow(0 0 8px rgba(74,156,204,0.5))}',
        '#xiao-trigger .xiao-speed-tag{position:absolute;bottom:-18px;left:50%;transform:translateX(-50%);background:var(--bamboo-dark);color:var(--paper);font-size:9px;font-weight:700;padding:2px 6px;border-radius:6px;white-space:nowrap;font-family:"Courier New",monospace;z-index:2;box-shadow:0 2px 6px rgba(0,0,0,.2);pointer-events:none}',
        '.sound-waves{position:absolute;top:4px;right:100%;width:40px;height:20px;pointer-events:none;overflow:visible}',
        '.sound-wave{position:absolute;top:50%;right:0;transform:translateY(-50%);width:10px;height:10px;border:1px solid #4ac0f0;border-radius:50%;opacity:0;animation:waveExpand 2s ease-out infinite}',
        '.sound-wave:nth-child(1){animation-delay:0s}.sound-wave:nth-child(2){animation-delay:.5s}.sound-wave:nth-child(3){animation-delay:1s}',
        '@keyframes waveExpand{0%{width:6px;height:6px;opacity:.6;right:0}100%{width:40px;height:40px;opacity:0;right:30px}}',
        '.ink-ripple{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:0;height:0;border-radius:50%;border:2px solid var(--jade);opacity:0;pointer-events:none}',
        '.ink-ripple.active{animation:inkRipple .6s ease-out forwards}',
        '@keyframes inkRipple{0%{width:0;height:0;opacity:.6;border-width:3px}100%{width:100px;height:100px;opacity:0;border-width:1px}}',
        '#xiao-panel{position:fixed;top:50%;left:-360px;transform:translateY(-50%);z-index:2147483646;width:clamp(220px,15vw,280px);max-width:calc(100vw - 24px);max-height:calc(100vh - 24px);transition:left .25s cubic-bezier(.22,1,.36,1),opacity .22s ease;opacity:0;visibility:hidden}',
        '#xiao-panel.open{left:calc(clamp(48px,7vh,72px) + 20px);opacity:1;visibility:visible}',
        '#xiao-panel.open.mobile-open{left:calc(clamp(40px,11vw,56px) + 10px)}',
        '.panel-body{background:linear-gradient(180deg,rgba(255,252,245,.98),rgba(245,240,230,.98));border:1px solid rgba(74,90,58,.25);border-radius:5px;padding:0 12px 10px;position:relative;box-shadow:0 8px 30px rgba(0,0,0,.12);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);overflow-y:auto;overflow-x:hidden;max-height:calc(100vh - 20px);scrollbar-width:thin;scrollbar-color:rgba(42,90,140,.4) transparent}',
        '.panel-body::before{content:"";position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--bamboo-dark),var(--bamboo-mid),var(--jade),var(--bamboo-mid),var(--bamboo-dark))}',
        '.panel-body::after{content:"";position:absolute;bottom:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(74,90,58,.2),transparent)}',
        '.bamboo-flow-light{position:absolute;top:2px;width:14px;height:3px;background:radial-gradient(ellipse,rgba(160,216,192,.85),transparent 70%);border-radius:50%;animation:bambooFlow 3s linear infinite;pointer-events:none;filter:blur(.5px)}',
        '@keyframes bambooFlow{0%{left:-5%;opacity:0}15%{opacity:.9}85%{opacity:.9}100%{left:105%;opacity:0}}',
        /* === 标题栏+印章（紧凑版） === */
        '.panel-header{padding:6px 0 4px;text-align:center;border-bottom:1px solid rgba(74,90,58,.1);margin-bottom:4px;position:relative}',
        '.panel-title{font-size:13px;color:var(--ink-deep);letter-spacing:3px;font-family:"STKaiti","KaiTi","\u6977\u4f53",serif}',
        '.panel-subtitle{font-size:8px;color:var(--ink-light);letter-spacing:1px;margin-top:2px;font-family:"STKaiti","KaiTi",serif}',
        '.panel-seal{position:absolute;top:8px;left:0;width:20px;height:20px;border:1.5px solid var(--red-seal);border-radius:3px;display:flex;align-items:center;justify-content:center;color:var(--red-seal);font-size:6px;font-weight:900;letter-spacing:1px;opacity:.7;transform:rotate(-8deg);transition:transform .35s cubic-bezier(.34,1.56,.64,1),box-shadow .35s ease,opacity .3s ease}',
        '.panel-seal.stamped{transform:rotate(0deg) scale(1.15);box-shadow:0 4px 12px rgba(195,39,43,.35);opacity:1}',
        /* === 紧凑面板：图片+速度数字 同一行 === */
        '.panel-hero{display:flex;align-items:center;gap:10px;padding:6px 0 6px;margin-bottom:4px;border-bottom:1px solid rgba(74,90,58,.1)}',
        '.panel-xiao{width:36px;height:72px;flex-shrink:0;display:flex;align-items:center;justify-content:center}',
        '.panel-xiao img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 0 5px rgba(80,180,230,.3))}',
        '.panel-hero-info{flex:1;text-align:center}',
        '.speed-num{font-size:28px;font-weight:bold;color:var(--bamboo-dark);font-family:"Courier New",monospace;line-height:1;letter-spacing:-1px;transition:color .3s ease,text-shadow .3s ease}',
        '.speed-unit{font-size:10px;color:var(--ink-light);margin-left:2px}',
        '.speed-mood{font-size:9px;color:var(--jade);margin-top:2px;letter-spacing:2px;transition:opacity .3s ease,transform .3s ease}',
        '.speed-mood.flash{animation:moodFlash .4s ease}',
        '@keyframes moodFlash{0%{opacity:.3;transform:translateY(3px)}100%{opacity:1;transform:translateY(0)}}',
        '.hole-selector{display:flex;justify-content:center;gap:6px;margin-bottom:8px;padding:6px;background:rgba(74,90,58,.03);border-radius:4px;border:1px solid rgba(74,90,58,.1)}',
        '.hole-group{display:flex;flex-direction:column;align-items:center;gap:3px}',
        '.hole-btn{width:18px;height:18px;border-radius:50%;border:2px solid var(--bamboo-mid);background:var(--paper);cursor:pointer;position:relative;transition:all .2s ease;padding:0}',
        '.hole-btn:hover{transform:scale(1.1);border-color:var(--bamboo-dark)}',
        '.hole-btn.active{background:var(--bamboo-dark);border-color:var(--bamboo-dark);box-shadow:0 0 8px rgba(74,90,58,.4)}',
        '.hole-btn.active::after{content:"";position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:5px;height:5px;background:var(--jade-light);border-radius:50%}',
        '.hole-label{font-size:7px;color:var(--ink-light);letter-spacing:1px}',
        '.speed-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-bottom:8px}',
        '.speed-btn{height:26px;border:1px solid rgba(74,90,58,.2);background:rgba(255,255,255,.5);color:var(--ink-mid);font-size:10px;font-weight:600;cursor:pointer;border-radius:3px;display:flex;align-items:center;justify-content:center;transition:all .2s ease;user-select:none}',
        '.speed-btn:hover{background:rgba(74,90,58,.1);border-color:var(--bamboo-mid)}',
        '.speed-btn.active{background:var(--bamboo-dark);border-color:var(--bamboo-dark);color:var(--paper)}',
        '.speed-slider-wrap{margin-bottom:6px;padding:4px 10px}',
        '.speed-slider-label{display:flex;justify-content:space-between;align-items:center;font-size:8px;color:var(--ink-light);margin-bottom:5px;letter-spacing:2px}',
        '.speed-slider-label span:last-child{color:var(--bamboo-dark);font-weight:700}',
        '.speed-slider{-webkit-appearance:none;appearance:none;width:100%;height:3px;border-radius:2px;background:linear-gradient(90deg,var(--bamboo-light) 0%,var(--bamboo-mid) 25%,var(--bamboo-dark) 50%,var(--jade) 75%,var(--jade-light) 100%);outline:none;cursor:pointer}',
        '.speed-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:12px;height:12px;border-radius:50%;background:var(--paper);border:2px solid var(--bamboo-dark);box-shadow:0 1px 3px rgba(0,0,0,.15),0 0 5px rgba(74,90,58,.3);cursor:grab;transition:transform .2s ease,box-shadow .2s ease}',
        '.speed-slider::-webkit-slider-thumb:hover{transform:scale(1.15)}',
        '.speed-slider::-moz-range-thumb{width:12px;height:12px;border-radius:50%;background:var(--paper);border:2px solid var(--bamboo-dark);box-shadow:0 1px 3px rgba(0,0,0,.15);cursor:grab}',
        '.scene-presets{display:flex;gap:3px;margin-bottom:8px;flex-wrap:wrap;justify-content:center}',
        '.scene-btn{padding:3px 6px;border:1px solid rgba(74,90,58,.2);background:rgba(255,255,255,.5);color:var(--ink-mid);font-size:8px;cursor:pointer;border-radius:8px;transition:all .25s ease;letter-spacing:1px;white-space:nowrap;user-select:none}',
        '.scene-btn:hover{background:var(--bamboo-dark);color:var(--paper);border-color:var(--bamboo-dark);transform:translateY(-1px);box-shadow:0 2px 5px rgba(74,90,58,.3)}',
        '.scene-btn.active{background:var(--bamboo-dark);color:var(--paper);border-color:var(--bamboo-dark)}',
        '.panel-controls{display:flex;gap:6px;align-items:center;justify-content:space-between}',
        '.ctrl-btn{flex:1;padding:6px 0;border:1px solid rgba(74,90,58,.2);background:rgba(255,255,255,.5);color:var(--ink-mid);font-size:10px;cursor:pointer;border-radius:3px;transition:all .2s ease;letter-spacing:1px;user-select:none}',
        '.ctrl-btn:hover{background:rgba(74,90,58,.1);border-color:var(--bamboo-mid)}',
        '.ctrl-btn.active-persist{background:rgba(195,39,43,.1);border-color:var(--red-seal);color:var(--red-seal)}',
        '.ctrl-btn-reset:hover{background:rgba(195,39,43,.08);border-color:var(--red-seal);color:var(--red-seal)}',
        '.panel-close{position:absolute;top:8px;right:8px;width:20px;height:20px;border:1px solid rgba(74,90,58,.2);background:rgba(255,255,255,.5);color:var(--ink-light);font-size:11px;cursor:pointer;border-radius:50%;display:flex;align-items:center;justify-content:center;transition:all .2s;z-index:10}',
        '.panel-close:hover{background:var(--bamboo-dark);color:var(--paper);border-color:var(--bamboo-dark);transform:rotate(90deg)}',
        '.kb-hint{text-align:center;margin-top:6px;font-size:8px;color:var(--ink-light);letter-spacing:2px;opacity:.6}',
        '.ink-splash{position:absolute;width:5px;height:5px;border-radius:50%;background:radial-gradient(circle,rgba(122,184,160,.85),rgba(74,90,58,.4) 60%,transparent);pointer-events:none;animation:inkSplash .6s ease-out forwards}',
        '@keyframes inkSplash{0%{transform:translate(0,0) scale(.3);opacity:.9}70%{opacity:.7}100%{transform:translate(var(--tx),var(--ty)) scale(.1);opacity:0}}',
        '.ink-ripple-layer{position:fixed;pointer-events:none;z-index:2147483646;width:100%;height:100%;left:0;top:0;overflow:hidden}',
        '.ink-ring{position:absolute;border-radius:50%;border:1px solid var(--bamboo-mid);box-shadow:0 0 10px rgba(74,90,58,.3),inset 0 0 10px rgba(74,90,58,.3);pointer-events:none;animation:inkRingExpand 1.2s ease-out forwards}',
        '@keyframes inkRingExpand{0%{width:0;height:0;opacity:.7;border-width:3px}100%{width:140px;height:140px;opacity:0;border-width:1px}}',
        '.particle-flow-layer{position:fixed;pointer-events:none;z-index:2147483645;overflow:visible}',
        '.xiao-particle{position:absolute;width:3px;height:3px;border-radius:50%;background:radial-gradient(circle,rgba(160,216,192,.9),rgba(122,184,160,.3) 70%,transparent);pointer-events:none;animation:particleFloat var(--p-dur,2s) ease-out forwards;filter:blur(.3px)}',
        '@keyframes particleFloat{0%{transform:translate(0,0) scale(1);opacity:.85}60%{opacity:.6}100%{transform:translate(var(--p-tx,0),var(--p-ty,-60px)) scale(.2);opacity:0}}',
        '.xiao-status-indicator{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:2147483646;background:rgba(26,26,26,.92);color:var(--paper);padding:6px 14px;border-radius:16px;font-size:11px;font-weight:bold;border:1px solid rgba(245,240,230,.2);pointer-events:none;opacity:0;transition:opacity 0.3s}',
        '.xiao-status-indicator.visible{opacity:1}',
        '.xiao-error-toast{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(220,53,69,0.95);color:#fff;padding:10px 18px;border-radius:6px;font-size:12px;font-weight:bold;z-index:2147483647;opacity:0;pointer-events:none;transition:opacity 0.3s;box-shadow:0 4px 12px rgba(0,0,0,0.3);text-align:center;max-width:80%}',
        '.xiao-error-toast.visible{opacity:1}',
        /* === 移动端 ≤640px（紧凑型） === */
        '@media(max-width:640px){#xiao-trigger{width:clamp(40px,11vw,56px);height:clamp(100px,28vw,145px);left:6px}#xiao-trigger .xiao-speed-tag{font-size:8px;padding:1px 5px;bottom:-16px}.sound-waves{width:clamp(30px,10vw,40px);height:clamp(15px,5vw,20px)}#xiao-panel{width:clamp(170px,56vw,230px);max-width:none;left:-110%}#xiao-panel.open{left:calc(clamp(40px,11vw,56px) + 10px)}.panel-body{padding:0 8px 8px;max-height:clamp(220px,50vh,380px);overflow-y:auto}.panel-header{padding:4px 0 3px;margin-bottom:3px}.panel-title{font-size:clamp(11px,3vw,13px);letter-spacing:2px}.panel-subtitle{font-size:7px;margin-top:1px}.panel-seal{width:16px;height:16px;font-size:5px;top:6px}.panel-hero{gap:8px;padding:5px 0 4px}.panel-xiao{width:clamp(28px,8vw,36px);height:clamp(56px,16vw,72px)}.speed-num{font-size:clamp(20px,6vw,26px)}.speed-unit{font-size:9px}.speed-mood{font-size:clamp(7px,2.2vw,9px);margin-top:2px}.hole-btn{width:16px;height:16px}.hole-btn.active::after{width:4px;height:4px}.hole-label{font-size:7px}.hole-selector{gap:4px;padding:4px;margin-bottom:6px}.speed-btn{height:clamp(24px,6.5vw,30px);font-size:clamp(9px,2.5vw,11px)}.speed-grid{gap:3px;margin-bottom:6px}.scene-btn{padding:clamp(3px,.8vw,4px) clamp(4px,1.5vw,7px);font-size:clamp(7px,2vw,9px)}.ctrl-btn{padding:clamp(4px,1.2vw,6px) 0;font-size:clamp(9px,2.5vw,11px)}.panel-close{width:18px;height:18px;font-size:10px;top:6px;right:6px}.speed-slider-wrap{padding:3px 8px;margin-bottom:4px}.speed-slider{height:3px}.speed-slider::-webkit-slider-thumb{width:14px;height:14px}.speed-slider::-moz-range-thumb{width:14px;height:14px}.panel-controls{gap:4px}.kb-hint{display:none}}',
        /* === 小屏 ≤360px === */
        '@media(max-width:360px){#xiao-trigger{width:36px;height:90px;left:4px}.panel-body{padding:0 6px 6px}.panel-header{padding:3px 0 2px;margin-bottom:2px}.panel-title{font-size:10px;letter-spacing:1px}.panel-subtitle{font-size:6px}.panel-seal{width:14px;height:14px;font-size:4px;top:4px}.panel-hero{gap:6px;padding:4px 0 3px}.panel-xiao{width:28px;height:56px}.speed-num{font-size:18px}.hole-selector{padding:3px;gap:3px;margin-bottom:4px}.ctrl-btn{padding:4px 0;font-size:9px}.speed-btn{height:22px;font-size:8px}.speed-grid{gap:2px}.scene-btn{padding:2px 4px;font-size:7px}.panel-close{width:16px;height:16px;font-size:9px}}',
        /* === 横屏 ≤500px高度 === */
        '@media(max-height:500px){#xiao-trigger{width:clamp(32px,9vh,44px);height:clamp(82px,23vh,114px)}#xiao-trigger .xiao-speed-tag{font-size:7px;padding:1px 4px;bottom:-14px}.sound-waves{width:28px;height:14px}#xiao-panel{max-height:calc(100vh - 6px)}.panel-body{max-height:calc(100vh - 6px)}#xiao-panel.open{left:calc(clamp(32px,9vh,44px) + 10px)}}',
        '@media(prefers-reduced-motion:reduce){.sound-wave,.ink-ripple,.speed-mood.flash,.bamboo-flow-light,#xiao-trigger.fast .xiao-img{animation-duration:.01ms !important;animation-iteration-count:1 !important}#xiao-trigger:hover{transform:none}}'
    ];

    var _styleNode = document.createElement('style');
    _styleNode.textContent = _cssText.join('');

    var _holeSpeeds = [0.5, 1, 2, 5, 20];
    var _moods = ['\u60a0\u7136\u7f13\u7f13', '\u6e05\u98ce\u5f90\u6765', '\u884c\u4e91\u6d41\u6c34', '\u6025\u7ba1\u7e41\u5f26', '\u77ac\u606f\u5343\u91cc'];
    var _gridSpeeds = [0.2, 0.5, 1, 2, 5, 10, 50, 100];
    var _scenePresets = [
        { name: '\u6625\u7720', speed: 0.5 },
        { name: '\u95f2\u96c5', speed: 1 },
        { name: '\u98de\u6d41', speed: 5 },
        { name: '\u834f\u82d2', speed: 20 }
    ];
    var _currentHole = 1;
    var _lastScene = null;

    var _trigger = document.createElement('div');
    _trigger.id = 'xiao-trigger';
    _trigger.setAttribute('role', 'button');
    _trigger.setAttribute('aria-label', '\u7389\u7bab\u52a0\u901f\u5668');
    _trigger.setAttribute('tabindex', '0');
    _trigger.innerHTML = [
        '<div class="sound-waves"><div class="sound-wave"></div><div class="sound-wave"></div><div class="sound-wave"></div></div>',
        '<video class="xiao-img" autoplay loop muted playsinline preload="auto">',
        '<source src="xiao02.webm" type="video/webm">',
        '<source src="xiao02.mp4" type="video/mp4">',
        '</video>',
        '<span class="xiao-speed-tag" id="xiaoSpeedTag">1x</span>',
        '<div class="ink-ripple" id="xiaoInkRipple"></div>'
    ].join('');

    var _panel = document.createElement('div');
    _panel.id = 'xiao-panel';
    _panel.setAttribute('role', 'dialog');
    _panel.setAttribute('aria-label', '\u52a0\u901f\u63a7\u5236\u9762\u677f');
    _panel.setAttribute('tabindex', '-1');

    var _gridHtml = '';
    for (var _gi = 0; _gi < _gridSpeeds.length; _gi++) {
        var gs = _gridSpeeds[_gi];
        _gridHtml += '<button class="speed-btn" data-speed="' + gs + '">' + gs + 'x</button>';
    }
    var _sceneHtml = '';
    for (var _si = 0; _si < _scenePresets.length; _si++) {
        var sc = _scenePresets[_si];
        _sceneHtml += '<button class="scene-btn' + (sc.speed === 1 ? ' active' : '') + '" data-scene="' + sc.name + '" data-speed="' + sc.speed + '">' + sc.name + '</button>';
    }
    var _holeHtml = [
        '<div class="hole-group"><button class="hole-btn" data-speed="0.5" data-hole="0"></button><span class="hole-label">\u7f13</span></div>',
        '<div class="hole-group"><button class="hole-btn active" data-speed="1" data-hole="1"></button><span class="hole-label">\u5e73</span></div>',
        '<div class="hole-group"><button class="hole-btn" data-speed="2" data-hole="2"></button><span class="hole-label">\u8212</span></div>',
        '<div class="hole-group"><button class="hole-btn" data-speed="5" data-hole="3"></button><span class="hole-label">\u6025</span></div>',
        '<div class="hole-group"><button class="hole-btn" data-speed="20" data-hole="4"></button><span class="hole-label">\u9aa4</span></div>'
    ].join('');

    _panel.innerHTML = [
        '<div class="panel-body">',
        '<div class="bamboo-flow-light"></div>',
        '<button class="panel-close" id="xiaoPanelClose" aria-label="\u5173\u95ed">\u00d7</button>',
        '<div class="panel-seal">\u7389\u7bab</div>',
        '<div class="panel-header">',
        '<div class="panel-title">\u7bab\u58f0\u8885\u8885</div>',
        '<div class="panel-subtitle">\u5439\u7bab\u5f15\u51e4 \u00b7 \u5149\u9634\u4f3c\u7bad</div>',
        '</div>',
        '<div class="panel-hero">',
        '<div class="panel-xiao"><img src="xiao_x_panel.png" alt="\u7389\u7bab"></div>',
        '<div class="panel-hero-info">',
        '<div><span class="speed-num" id="xiaoSpeedNum">1</span><span class="speed-unit">\u500d\u901f</span></div>',
        '<div class="speed-mood" id="xiaoSpeedMood">\u6e05\u98ce\u5f90\u6765</div>',
        '</div>',
        '</div>',
        '<div class="speed-slider-wrap">',
        '<div class="speed-slider-label"><span>\u8c03\u901f</span><span id="xiaoSliderVal">1x</span></div>',
        '<input type="range" class="speed-slider" id="xiaoSpeedSlider" min="0.2" max="100" step="0.1" value="1" aria-label="\u65e0\u7ea7\u8c03\u901f\u6ed1\u6746">',
        '</div>',
        '<div class="hole-selector">', _holeHtml, '</div>',
        '<div class="speed-grid">', _gridHtml, '</div>',
        '<div class="scene-presets">', _sceneHtml, '</div>',
        '<div class="panel-controls">',
        '<button class="ctrl-btn" id="xiaoBtnPersist">\u94ed\u8bb0</button>',
        '<button class="ctrl-btn ctrl-btn-reset" id="xiaoBtnReset">\u5f52\u97f5</button>',
        '</div>',
        '</div>'
    ].join('');

    var _inkRippleLayer = document.createElement('div');
    _inkRippleLayer.className = 'ink-ripple-layer';
    _inkRippleLayer.id = 'xiaoInkRippleLayer';

    var _particleLayer = document.createElement('div');
    _particleLayer.className = 'particle-flow-layer';
    _particleLayer.id = 'xiaoParticleLayer';

    var _statusIndicator = document.createElement('div');
    _statusIndicator.className = 'xiao-status-indicator';
    _statusIndicator.setAttribute('aria-live', 'polite');

    var _errorToast = document.createElement('div');
    _errorToast.className = 'xiao-error-toast';

    function _mountUI() {
        if (window.__xiaoRendered) return;
        window.__xiaoRendered = true;

        document.head.appendChild(_styleNode);

        var _frag = document.createDocumentFragment();
        _frag.appendChild(_trigger);
        _frag.appendChild(_statusIndicator);
        _frag.appendChild(_errorToast);
        _frag.appendChild(_panel);
        _frag.appendChild(_inkRippleLayer);
        _frag.appendChild(_particleLayer);
        document.body.appendChild(_frag);

        var _speedTag = document.getElementById('xiaoSpeedTag');
        var _speedNum = document.getElementById('xiaoSpeedNum');
        var _speedMood = document.getElementById('xiaoSpeedMood');
        var _sliderVal = document.getElementById('xiaoSliderVal');
        var _speedSlider = document.getElementById('xiaoSpeedSlider');
        var _xiaoVideo = _trigger.querySelector('video');
        var _speedGrid = _panel.querySelectorAll('.speed-btn');
        var _holeBtns = _panel.querySelectorAll('.hole-btn');
        var _sceneBtns = _panel.querySelectorAll('.scene-btn');
        var _btnPersist = document.getElementById('xiaoBtnPersist');
        var _btnReset = document.getElementById('xiaoBtnReset');
        var _panelClose = document.getElementById('xiaoPanelClose');
        var _inkRipple = document.getElementById('xiaoInkRipple');
        var _waveSvg = document.getElementById('xiaoWaveSvg');
        var _seal = _panel.querySelector('.panel-seal');

        // ===== 视频播放 + 倍速同步 =====
        if (_xiaoVideo) {
            window._xiaoVideo = _xiaoVideo;
            function _applyVideoSpeed() {
                var spd = _jsq_value || 1;
                try { _xiaoVideo.playbackRate = Math.max(0.25, Math.min(16, spd)); } catch (e) { }
            }
            _xiaoVideo.addEventListener('loadeddata', function () {
                _xiaoVideo.play().catch(function () { });
                _applyVideoSpeed();
            });
            _xiaoVideo.addEventListener('play', function () { _applyVideoSpeed(); });
            _applyVideoSpeed();
            // 轮询兜底：确保 playbackRate 始终同步
            setInterval(function () {
                if (_xiaoVideo && _jsq_value) {
                    var r = Math.max(0.25, Math.min(16, _jsq_value));
                    if (Math.abs(_xiaoVideo.playbackRate - r) > 0.01) _xiaoVideo.playbackRate = r;
                }
            }, 500);

            // ===== 微信兜底：canvas 逐帧抠绿 =====
            // 微信 X5/XWeb 对 SVG filter 应用于 video 的支持存疑，mp4(H.264) 无透明通道，
            // 若滤镜失效会显示绿幕。微信环境改用 canvas 逐帧 drawImage + JS 抠绿，保证透明正确。
            var _isWeChat = /MicroMessenger|wxwork/i.test(navigator.userAgent);
            if (_isWeChat) {
                try {
                    var _ckCanvas = document.createElement('canvas');
                    _ckCanvas.setAttribute('aria-hidden', 'true');
                    _ckCanvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;border-radius:6px;display:none;pointer-events:none;filter:drop-shadow(0 0 8px rgba(74,156,204,0.5));';
                    _xiaoVideo.parentNode.appendChild(_ckCanvas);
                    var _ckCtx = _ckCanvas.getContext('2d');
                    var _ckBg = { r: 60, g: 80, b: 46 };
                    var _ckInner = 42, _ckOuter = 62;
                    var _ckRaf = 0, _ckRun = false;
                    function _ckTick() {
                        if (!_ckRun) return;
                        _ckRaf = requestAnimationFrame(_ckTick);
                        var tw = _trigger.offsetWidth, th = _trigger.offsetHeight;
                        if (!tw || !th) return;
                        if (!_xiaoVideo.videoWidth || _xiaoVideo.readyState < 2) return;
                        var dpr = Math.min(2, window.devicePixelRatio || 1);
                        var w = Math.max(1, Math.round(tw * dpr)), h = Math.max(1, Math.round(th * dpr));
                        if (_ckCanvas.width !== w) _ckCanvas.width = w;
                        if (_ckCanvas.height !== h) _ckCanvas.height = h;
                        _ckCtx.drawImage(_xiaoVideo, 0, 0, w, h);
                        try {
                            var img = _ckCtx.getImageData(0, 0, w, h);
                            var dd = img.data;
                            for (var i = 0; i < dd.length; i += 4) {
                                var dr = Math.abs(dd[i] - _ckBg.r);
                                var dg = Math.abs(dd[i + 1] - _ckBg.g);
                                var db = Math.abs(dd[i + 2] - _ckBg.b);
                                var dist = Math.max(dr, dg, db);
                                if (dist <= _ckInner) {
                                    dd[i + 3] = 0;
                                } else if (dist < _ckOuter) {
                                    dd[i + 3] = Math.round((dist - _ckInner) / (_ckOuter - _ckInner) * 255);
                                }
                            }
                            _ckCtx.putImageData(img, 0, 0);
                        } catch (e2) { }
                    }
                    function _ckStart() {
                        if (_ckRun) return;
                        _ckRun = true;
                        _xiaoVideo.style.display = 'none';
                        _ckCanvas.style.display = 'block';
                        _ckTick();
                    }
                    function _ckStop() {
                        _ckRun = false;
                        if (_ckRaf) cancelAnimationFrame(_ckRaf);
                        _ckCanvas.style.display = 'none';
                        _xiaoVideo.style.display = '';
                    }
                    _xiaoVideo.addEventListener('loadeddata', function () { _ckStart(); });
                    _xiaoVideo.addEventListener('play', function () { _ckStart(); });
                    window._xiaoCkStop = _ckStop;
                } catch (e3) { }
            }
        }

        var _panelOpen = false;

        function _showError(msg) {
            _errorToast.textContent = msg;
            _errorToast.classList.add('visible');
            _origSetTimeout.call(window, function () { _errorToast.classList.remove('visible'); }, 2000);
        }

        function _showStatus(speed) {
            _statusIndicator.textContent = speed !== 1 ? '\u52a0\u901f\u5df2\u542f\u7528: ' + speed + 'x' : '\u901f\u5ea6\u5df2\u5f52\u97f5';
            _statusIndicator.classList.add('visible');
            _origSetTimeout.call(window, function () { _statusIndicator.classList.remove('visible'); }, speed !== 1 ? 2000 : 1000);
        }

        function _spawnInkSplash(origin) {
            var rect = origin.getBoundingClientRect();
            var cx = rect.left + rect.width / 2;
            var cy = rect.top + rect.height / 2;
            var count = 6 + Math.floor(Math.random() * 4);
            for (var i = 0; i < count; i++) {
                var p = document.createElement('div');
                p.className = 'ink-splash';
                var angle = (Math.PI * 2 * i / count) + (Math.random() - .5) * .5;
                var dist = 30 + Math.random() * 50;
                var tx = Math.cos(angle) * dist;
                var ty = Math.sin(angle) * dist;
                var size = 3 + Math.random() * 6;
                p.style.width = size + 'px'; p.style.height = size + 'px';
                p.style.left = cx + 'px'; p.style.top = cy + 'px';
                p.style.setProperty('--tx', tx + 'px');
                p.style.setProperty('--ty', ty + 'px');
                p.addEventListener('animationend', function () { this.remove(); });
                _inkRippleLayer.appendChild(p);
            }
        }

        function _spawnWaterRipple(origin) {
            var rect = origin.getBoundingClientRect();
            var cx = rect.left + rect.width / 2;
            var cy = rect.top + rect.height / 2;
            for (var i = 0; i < 2; i++) {
                var ring = document.createElement('div');
                ring.className = 'ink-ring';
                ring.style.left = cx + 'px'; ring.style.top = cy + 'px';
                ring.style.animationDelay = (i * .15) + 's';
                ring.addEventListener('animationend', function () { this.remove(); });
                _inkRippleLayer.appendChild(ring);
            }
        }

        function _spawnParticleFlow(origin, speed) {
            var rect = origin.getBoundingClientRect();
            var cx = rect.left + rect.width / 2;
            var cy = rect.top + 20;
            var intensity = Math.max(1, Math.round(speed));
            var count = Math.min(6, 1 + Math.floor(intensity / 3));
            for (var i = 0; i < count; i++) {
                (function (ii) {
                    _origSetTimeout.call(window, function () {
                        var p = document.createElement('div');
                        p.className = 'xiao-particle';
                        var angle = -Math.PI / 2 + (Math.random() - .5) * 1.2;
                        var dist = 40 + Math.random() * 60;
                        var tx = Math.cos(angle) * dist;
                        var ty = Math.sin(angle) * dist;
                        var dur = (1.5 + Math.random() * 1.5) + 's';
                        var size = 2 + Math.random() * 4;
                        p.style.width = size + 'px'; p.style.height = size + 'px';
                        p.style.left = cx + 'px'; p.style.top = cy + 'px';
                        p.style.setProperty('--p-tx', tx + 'px');
                        p.style.setProperty('--p-ty', ty + 'px');
                        p.style.setProperty('--p-dur', dur);
                        p.addEventListener('animationend', function () { this.remove(); });
                        _particleLayer.appendChild(p);
                    }, ii * 120);
                })(i);
            }
        }

        function _playInkRipple() {
            _inkRipple.classList.remove('active');
            void _inkRipple.offsetWidth;
            _inkRipple.classList.add('active');
            _spawnInkSplash(_trigger);
            _spawnWaterRipple(_trigger);
        }

        function _setSpeedUI(v, holeIdx) {
            _jsq_value = v;
            _trigger.classList.toggle('fast', v > 1);
            if (_xiaoVideo) { try { _xiaoVideo.playbackRate = Math.min(v, 16); } catch(e) {} }
            if (typeof holeIdx === 'number') {
                _currentHole = holeIdx;
            } else {
                var nearest = 1, minDiff = Infinity;
                for (var i = 0; i < _holeSpeeds.length; i++) {
                    var diff = Math.abs(Math.log(_holeSpeeds[i]) - Math.log(v));
                    if (diff < minDiff) { minDiff = diff; nearest = i; }
                }
                _currentHole = nearest;
            }

            var label = v >= 10 ? Math.round(v) : (Math.round(v * 10) / 10);
            _speedTag.textContent = label + 'x';
            _speedNum.textContent = label;
            _speedMood.textContent = _moods[_currentHole];
            _speedMood.classList.remove('flash'); void _speedMood.offsetWidth; _speedMood.classList.add('flash');
            _sliderVal.textContent = label + 'x';
            _speedSlider.value = v;

            for (var h = 0; h < _holeBtns.length; h++) {
                _holeBtns[h].classList.toggle('active', h === _currentHole);
            }
            for (var b = 0; b < _speedGrid.length; b++) {
                _speedGrid[b].classList.toggle('active', Math.abs(parseFloat(_speedGrid[b].dataset.speed) - v) < 0.01);
            }
            if (!_lastScene) {
                for (var s = 0; s < _sceneBtns.length; s++) {
                    _sceneBtns[s].classList.toggle('active', Math.abs(parseFloat(_sceneBtns[s].dataset.speed) - v) < 0.01);
                }
            }

            var animSpeed = Math.max(0.3, 2 / v);
            if (_waveSvg) {
                var waveAnims = _waveSvg.querySelectorAll('animate');
                for (var w = 0; w < waveAnims.length; w++) {
                    var anim = waveAnims[w];
                    var baseDur = parseFloat(anim.dataset.baseDur || anim.getAttribute('dur'));
                    anim.dataset.baseDur = baseDur;
                    anim.setAttribute('dur', (baseDur * animSpeed) + 's');
                }
            }
            var soundWaves = _trigger.querySelectorAll('.sound-wave');
            for (var sw = 0; sw < soundWaves.length; sw++) {
                soundWaves[sw].style.animationDuration = Math.max(0.5, 2 / v) + 's';
            }

            try {
                _applySpeed(v);
                window._xiaoCurrentSpeed = v;
                _showStatus(v);
            } catch (error) {
                _showError('\u52a0\u901f\u5931\u8d25: ' + error.message);
            }

            _spawnParticleFlow(_trigger, v);

            if (_isPersistent) {
                try { localStorage.setItem('accel_xiao_speed', v); } catch (e) { }
            }
        }

        function _togglePersist() {
            _isPersistent = !_isPersistent;
            if (_isPersistent) {
                try {
                    localStorage.setItem('accel_xiao_persist', 'true');
                    localStorage.setItem('accel_xiao_speed', _jsq_value);
                } catch (e) { }
            } else {
                try {
                    localStorage.removeItem('accel_xiao_speed');
                    localStorage.removeItem('accel_xiao_persist');
                } catch (e) { }
            }
            _btnPersist.classList.toggle('active-persist', _isPersistent);
            _btnPersist.textContent = _isPersistent ? '\u5df2\u94ed' : '\u94ed\u8bb0';
            if (_seal) _seal.classList.toggle('stamped', _isPersistent);
        }

        function _togglePanel(open) {
            _panelOpen = typeof open === 'boolean' ? open : !_panelOpen;
            if (_panelOpen) {
                _trigger.classList.remove('scrolled');
                var isMobile = window.innerWidth <= 640;
                _panel.classList.toggle('mobile-open', isMobile);
                if (isMobile) {
                    // 移动端：清除内联定位，让CSS class控制位置
                    _panel.style.left = '';
                    _panel.style.top = '';
                    _panel.style.transform = '';
                    _trigger.style.left = '';
                    _trigger.style.top = '';
                    _trigger.style.transform = '';
                } else if (_panel.style.left) {
                    var pw = _panel.offsetWidth || 240;
                    var pl = parseInt(_panel.style.left) || 0;
                    if (pl + pw > window.innerWidth - 8) _panel.style.left = Math.max(8, window.innerWidth - pw - 8) + 'px';
                    if (pl < 8) _panel.style.left = 8 + 'px';
                }
            } else {
                _panel.classList.remove('mobile-open');
            }
            _panel.classList.toggle('open', _panelOpen);
        }

        // Speed slider
        _speedSlider.addEventListener('input', function () {
            var val = parseFloat(this.value);
            _setSpeedUI(val);
        });

        // Grid buttons
        for (var _k = 0; _k < _speedGrid.length; _k++) {
            _speedGrid[_k].addEventListener('click', function () {
                _setSpeedUI(parseFloat(this.getAttribute('data-speed')));
                _playInkRipple();
            });
        }

        // Hole buttons
        for (var _h = 0; _h < _holeBtns.length; _h++) {
            _holeBtns[_h].addEventListener('click', function () {
                var s = parseFloat(this.getAttribute('data-speed'));
                var h = parseInt(this.getAttribute('data-hole'));
                _setSpeedUI(s, h);
                _playInkRipple();
            });
        }

        // Scene buttons
        for (var _sc = 0; _sc < _sceneBtns.length; _sc++) {
            _sceneBtns[_sc].addEventListener('click', function () {
                var s = parseFloat(this.getAttribute('data-speed'));
                _lastScene = this.getAttribute('data-scene');
                _setSpeedUI(s);
                _playInkRipple();
            });
        }

        // Panel events
        _panelClose.addEventListener('click', function () { _togglePanel(false); });
        _btnReset.addEventListener('click', function () { _setSpeedUI(1, 1); _playInkRipple(); });
        _btnPersist.addEventListener('click', _togglePersist);

        // Trigger click (single click opens panel, double click resets)
        (function () {
            var _clickTimer = 0;
            _trigger.addEventListener('click', function (e) {
                if (_trigger._dragged) { _trigger._dragged = false; return; }
                if (_clickTimer) {
                    _origClearTimeout.call(window, _clickTimer);
                    _clickTimer = 0;
                    _setSpeedUI(1, 1);
                    return;
                }
                _clickTimer = _origSetTimeout.call(window, function () {
                    _clickTimer = 0;
                    _togglePanel();
                    _playInkRipple();
                    _spawnParticleFlow(_trigger, _jsq_value);
                }, 250);
            }, false);
        })();

        // Click outside to close
        document.addEventListener('mousedown', function (e) {
            if (_panelOpen && !_panel.contains(e.target) && !_trigger.contains(e.target)) _togglePanel(false);
        });

        // Trigger drag
        (function (el) {
            var _dragging = false, _sx = null, _sy = null, _moved = false;
            function _onDown(e) {
                _dragging = true; _moved = false;
                var t = e.touches ? e.touches[0] : e;
                _sx = t.clientX; _sy = t.clientY;
                _xiaoOffX = el.offsetLeft; _xiaoOffY = el.offsetTop;
                el.classList.add('dragging');
                if (!e.touches) e.preventDefault();
            }
            function _onMove(e) {
                if (!_dragging || _sx === null) return;
                var t = e.touches ? e.touches[0] : e;
                var dx = t.clientX - _sx, dy = t.clientY - _sy;
                if (Math.abs(dx) > 3 || Math.abs(dy) > 3) _moved = true;
                var tw = el.offsetWidth, th = el.offsetHeight;
                _xiaoOffX = Math.max(0, Math.min(window.innerWidth - tw, _xiaoOffX + dx));
                _xiaoOffY = Math.max(0, Math.min(window.innerHeight - th, _xiaoOffY + dy));
                el.style.left = _xiaoOffX + 'px';
                el.style.top = _xiaoOffY + 'px';
                el.style.transform = 'translateY(0)';
                var ph = _panel.offsetHeight || 440;
                _panel.style.top = Math.max(0, Math.min(window.innerHeight - ph, _xiaoOffY + th / 2 - ph / 2)) + 'px';
                var pw = _panel.offsetWidth || 300;
                var pl = _xiaoOffX + tw + 8;
                if (pl + pw > window.innerWidth - 8) pl = Math.max(8, window.innerWidth - pw - 8);
                _panel.style.left = pl + 'px';
                _panel.style.transform = 'translateY(0)';
                _sx = t.clientX; _sy = t.clientY;
                e.preventDefault();
            }
            function _onUp() {
                if (!_dragging) return;
                _dragging = false;
                el.classList.remove('dragging');
                el._dragged = _moved;
                _sx = null;
                try {
                    localStorage.setItem('accel_xiao_drag_pos', JSON.stringify({
                        left: el.style.left, top: el.style.top,
                        panelTop: _panel.style.top, panelLeft: _panel.style.left
                    }));
                } catch (e2) { }
            }
            el.addEventListener('mousedown', _onDown);
            document.addEventListener('mousemove', _onMove);
            document.addEventListener('mouseup', _onUp);
            el.addEventListener('touchstart', _onDown, { passive: false });
            document.addEventListener('touchmove', _onMove, { passive: false });
            document.addEventListener('touchend', _onUp);
        })(_trigger);

        // Restore drag position (PC only, mobile uses CSS positioning)
        try {
            var savedPos = JSON.parse(localStorage.getItem('accel_xiao_drag_pos'));
            if (savedPos && savedPos.left && window.innerWidth > 640) {
                var _tl = parseFloat(savedPos.left), _tt = parseFloat(savedPos.top);
                if (!isNaN(_tl) && !isNaN(_tt)) {
                    _tl = Math.max(0, Math.min(window.innerWidth - _trigger.offsetWidth, _tl));
                    _tt = Math.max(0, Math.min(window.innerHeight - _trigger.offsetHeight, _tt));
                    _trigger.style.left = _tl + 'px';
                    _trigger.style.top = _tt + 'px';
                    _trigger.style.transform = 'translateY(0)';
                }
                if (savedPos.panelTop) {
                    var _pt = parseFloat(savedPos.panelTop), _pl = parseFloat(savedPos.panelLeft);
                    if (!isNaN(_pt) && !isNaN(_pl)) {
                        var _pw = _panel.offsetWidth || 300;
                        _pt = Math.max(0, Math.min(window.innerHeight - _panel.offsetHeight, _pt));
                        _pl = Math.max(8, Math.min(window.innerWidth - _pw - 8, _pl));
                        _panel.style.top = _pt + 'px';
                        _panel.style.left = _pl + 'px';
                        _panel.style.transform = 'translateY(0)';
                    }
                }
            }
        } catch (e3) { }

        // Keyboard shortcuts
        _panel.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') { _togglePanel(false); return; }
            if (e.key !== 'Tab') return;
            var focusable = _panel.querySelectorAll('.speed-btn, .hole-btn, .scene-btn, #xiaoPanelClose, #xiaoBtnPersist, #xiaoBtnReset, #xiaoSpeedSlider');
            if (focusable.length === 0) return;
            var first = focusable[0], last = focusable[focusable.length - 1];
            if (e.shiftKey) {
                if (document.activeElement === first) { e.preventDefault(); last.focus(); }
            } else {
                if (document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
        });

        // Initialize from storage
        try {
            var _savedPersist = localStorage.getItem('accel_xiao_persist');
            var _savedSpeed = localStorage.getItem('accel_xiao_speed');
            if (_savedPersist === 'true' && _savedSpeed) {
                var _spd = parseFloat(_savedSpeed);
                if (!isNaN(_spd) && _spd > 0) {
                    _isPersistent = true;
                    _btnPersist.classList.add('active-persist');
                    _btnPersist.textContent = '\u5df2\u94ed';
                    if (_seal) _seal.classList.add('stamped');
                    _origSetTimeout.call(window, function () { _setSpeedUI(_spd); }, 500);
                }
            }
        } catch (e4) { }

        if (!_isPersistent) {
            _setSpeedUI(1, 1);
        }

        // Global keyboard
        window.addEventListener('keydown', function (e) {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            var currentSpeed = _invPercentage;
            if (e.key === '9' && (e.ctrlKey || e.altKey)) {
                var t = prompt('\u8f93\u5165\u6b32\u6539\u53d8\u7684\u500d\u7387\uff08\u5f53\u524d\uff1a' + currentSpeed.toFixed(2) + '\uff09');
                if (t == null) return;
                if (isNaN(parseFloat(t))) return;
                if (parseFloat(t) <= 0) return;
                _setSpeedUI(parseFloat(t));
            } else if ((e.key === '=' || e.key === '.') && e.ctrlKey) {
                _setSpeedUI(Math.min(100, currentSpeed + 2));
            } else if ((e.key === '=' || e.key === '.') && e.altKey) {
                _setSpeedUI(Math.min(100, currentSpeed * 2));
            } else if ((e.key === '-' || e.key === ',') && e.ctrlKey) {
                _setSpeedUI(Math.max(0.2, currentSpeed - 2));
            } else if ((e.key === '-' || e.key === ',') && e.altKey) {
                _setSpeedUI(Math.max(0.2, currentSpeed / 2));
            } else if (e.key === '0' && (e.ctrlKey || e.altKey)) {
                _setSpeedUI(1, 1);
            }
            if (e.key === '[' || e.key === '\u3010') {
                var h = Math.max(0, _currentHole - 1);
                _setSpeedUI(_holeSpeeds[h], h);
            } else if (e.key === ']' || e.key === '\u3011') {
                var h2 = Math.min(_holeSpeeds.length - 1, _currentHole + 1);
                _setSpeedUI(_holeSpeeds[h2], h2);
            } else if (e.key === '0') {
                _setSpeedUI(1, 1);
            } else if (e.key === 'p' || e.key === 'P') {
                _togglePersist();
            }
        });

        // ===== 滚动自动半透明收起 =====
        var _scrollT = 0;
        function _onScroll() {
            _trigger.classList.add('scrolled');
            if (_scrollT) _origClearTimeout.call(window, _scrollT);
            _scrollT = _origSetTimeout.call(window, function () {
                _scrollT = 0;
                _trigger.classList.remove('scrolled');
            }, 1500);
        }
        window.addEventListener('scroll', _onScroll, { passive: true, capture: true });
        document.addEventListener('touchmove', _onScroll, { passive: true });
        _trigger.addEventListener('mouseenter', function () { _trigger.classList.remove('scrolled'); });
    }

    if (document.readyState === 'interactive' || document.readyState === 'complete') {
        _mountUI();
    } else {
        document.addEventListener('readystatechange', function () {
            if ((document.readyState === 'interactive' || document.readyState === 'complete') && !window.__xiaoRendered) {
                _mountUI();
            }
        });
    }
})();
