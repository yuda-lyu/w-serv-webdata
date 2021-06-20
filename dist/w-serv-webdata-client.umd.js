/*!
 * w-serv-webdata-client v1.0.11
 * (c) 2018-2021 yuda-lyu(semisphere)
 * Released under the MIT License.
 */
!function(t,r){"object"==typeof exports&&"undefined"!=typeof module?module.exports=r():"function"==typeof define&&define.amd?define(r):(t="undefined"!=typeof globalThis?globalThis:t||self)["w-serv-webdata-client"]=r()}(this,(function(){"use strict";function t(t,r,e,n,o,i,a){try{var u=t[i](a),c=u.value}catch(t){return void e(t)}u.done?r(c):Promise.resolve(c).then(n,o)}function r(r){return function(){var e=this,n=arguments;return new Promise((function(o,i){var a=r.apply(e,n);function u(r){t(a,o,i,u,c,"next",r)}function c(r){t(a,o,i,u,c,"throw",r)}u(void 0)}))}}function e(t){return(e="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t})(t)}var n="undefined"!=typeof globalThis?globalThis:"undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof self?self:{};function o(t){var r={exports:{}};return t(r,r.exports),r.exports}var i=o((function(t){var r=function(t){var r,n=Object.prototype,o=n.hasOwnProperty,i="function"==typeof Symbol?Symbol:{},a=i.iterator||"@@iterator",u=i.asyncIterator||"@@asyncIterator",c=i.toStringTag||"@@toStringTag";function f(t,r,e){return Object.defineProperty(t,r,{value:e,enumerable:!0,configurable:!0,writable:!0}),t[r]}try{f({},"")}catch(t){f=function(t,r,e){return t[r]=e}}function s(t,r,e,n){var o=r&&r.prototype instanceof g?r:g,i=Object.create(o.prototype),a=new A(n||[]);return i._invoke=function(t,r,e){var n=v;return function(o,i){if(n===h)throw new Error("Generator is already running");if(n===y){if("throw"===o)throw i;return N()}for(e.method=o,e.arg=i;;){var a=e.delegate;if(a){var u=L(a,e);if(u){if(u===d)continue;return u}}if("next"===e.method)e.sent=e._sent=e.arg;else if("throw"===e.method){if(n===v)throw n=y,e.arg;e.dispatchException(e.arg)}else"return"===e.method&&e.abrupt("return",e.arg);n=h;var c=l(t,r,e);if("normal"===c.type){if(n=e.done?y:p,c.arg===d)continue;return{value:c.arg,done:e.done}}"throw"===c.type&&(n=y,e.method="throw",e.arg=c.arg)}}}(t,e,a),i}function l(t,r,e){try{return{type:"normal",arg:t.call(r,e)}}catch(t){return{type:"throw",arg:t}}}t.wrap=s;var v="suspendedStart",p="suspendedYield",h="executing",y="completed",d={};function g(){}function b(){}function m(){}var _={};_[a]=function(){return this};var w=Object.getPrototypeOf,j=w&&w(w(P([])));j&&j!==n&&o.call(j,a)&&(_=j);var x=m.prototype=g.prototype=Object.create(_);function O(t){["next","throw","return"].forEach((function(r){f(t,r,(function(t){return this._invoke(r,t)}))}))}function T(t,r){function n(i,a,u,c){var f=l(t[i],t,a);if("throw"!==f.type){var s=f.arg,v=s.value;return v&&"object"===e(v)&&o.call(v,"__await")?r.resolve(v.__await).then((function(t){n("next",t,u,c)}),(function(t){n("throw",t,u,c)})):r.resolve(v).then((function(t){s.value=t,u(s)}),(function(t){return n("throw",t,u,c)}))}c(f.arg)}var i;this._invoke=function(t,e){function o(){return new r((function(r,o){n(t,e,r,o)}))}return i=i?i.then(o,o):o()}}function L(t,e){var n=t.iterator[e.method];if(n===r){if(e.delegate=null,"throw"===e.method){if(t.iterator.return&&(e.method="return",e.arg=r,L(t,e),"throw"===e.method))return d;e.method="throw",e.arg=new TypeError("The iterator does not provide a 'throw' method")}return d}var o=l(n,t.iterator,e.arg);if("throw"===o.type)return e.method="throw",e.arg=o.arg,e.delegate=null,d;var i=o.arg;return i?i.done?(e[t.resultName]=i.value,e.next=t.nextLoc,"return"!==e.method&&(e.method="next",e.arg=r),e.delegate=null,d):i:(e.method="throw",e.arg=new TypeError("iterator result is not an object"),e.delegate=null,d)}function E(t){var r={tryLoc:t[0]};1 in t&&(r.catchLoc=t[1]),2 in t&&(r.finallyLoc=t[2],r.afterLoc=t[3]),this.tryEntries.push(r)}function S(t){var r=t.completion||{};r.type="normal",delete r.arg,t.completion=r}function A(t){this.tryEntries=[{tryLoc:"root"}],t.forEach(E,this),this.reset(!0)}function P(t){if(t){var e=t[a];if(e)return e.call(t);if("function"==typeof t.next)return t;if(!isNaN(t.length)){var n=-1,i=function e(){for(;++n<t.length;)if(o.call(t,n))return e.value=t[n],e.done=!1,e;return e.value=r,e.done=!0,e};return i.next=i}}return{next:N}}function N(){return{value:r,done:!0}}return b.prototype=x.constructor=m,m.constructor=b,b.displayName=f(m,c,"GeneratorFunction"),t.isGeneratorFunction=function(t){var r="function"==typeof t&&t.constructor;return!!r&&(r===b||"GeneratorFunction"===(r.displayName||r.name))},t.mark=function(t){return Object.setPrototypeOf?Object.setPrototypeOf(t,m):(t.__proto__=m,f(t,c,"GeneratorFunction")),t.prototype=Object.create(x),t},t.awrap=function(t){return{__await:t}},O(T.prototype),T.prototype[u]=function(){return this},t.AsyncIterator=T,t.async=function(r,e,n,o,i){void 0===i&&(i=Promise);var a=new T(s(r,e,n,o),i);return t.isGeneratorFunction(e)?a:a.next().then((function(t){return t.done?t.value:a.next()}))},O(x),f(x,c,"Generator"),x[a]=function(){return this},x.toString=function(){return"[object Generator]"},t.keys=function(t){var r=[];for(var e in t)r.push(e);return r.reverse(),function e(){for(;r.length;){var n=r.pop();if(n in t)return e.value=n,e.done=!1,e}return e.done=!0,e}},t.values=P,A.prototype={constructor:A,reset:function(t){if(this.prev=0,this.next=0,this.sent=this._sent=r,this.done=!1,this.delegate=null,this.method="next",this.arg=r,this.tryEntries.forEach(S),!t)for(var e in this)"t"===e.charAt(0)&&o.call(this,e)&&!isNaN(+e.slice(1))&&(this[e]=r)},stop:function(){this.done=!0;var t=this.tryEntries[0].completion;if("throw"===t.type)throw t.arg;return this.rval},dispatchException:function(t){if(this.done)throw t;var e=this;function n(n,o){return u.type="throw",u.arg=t,e.next=n,o&&(e.method="next",e.arg=r),!!o}for(var i=this.tryEntries.length-1;i>=0;--i){var a=this.tryEntries[i],u=a.completion;if("root"===a.tryLoc)return n("end");if(a.tryLoc<=this.prev){var c=o.call(a,"catchLoc"),f=o.call(a,"finallyLoc");if(c&&f){if(this.prev<a.catchLoc)return n(a.catchLoc,!0);if(this.prev<a.finallyLoc)return n(a.finallyLoc)}else if(c){if(this.prev<a.catchLoc)return n(a.catchLoc,!0)}else{if(!f)throw new Error("try statement without catch or finally");if(this.prev<a.finallyLoc)return n(a.finallyLoc)}}}},abrupt:function(t,r){for(var e=this.tryEntries.length-1;e>=0;--e){var n=this.tryEntries[e];if(n.tryLoc<=this.prev&&o.call(n,"finallyLoc")&&this.prev<n.finallyLoc){var i=n;break}}i&&("break"===t||"continue"===t)&&i.tryLoc<=r&&r<=i.finallyLoc&&(i=null);var a=i?i.completion:{};return a.type=t,a.arg=r,i?(this.method="next",this.next=i.finallyLoc,d):this.complete(a)},complete:function(t,r){if("throw"===t.type)throw t.arg;return"break"===t.type||"continue"===t.type?this.next=t.arg:"return"===t.type?(this.rval=this.arg=t.arg,this.method="return",this.next="end"):"normal"===t.type&&r&&(this.next=r),d},finish:function(t){for(var r=this.tryEntries.length-1;r>=0;--r){var e=this.tryEntries[r];if(e.finallyLoc===t)return this.complete(e.completion,e.afterLoc),S(e),d}},catch:function(t){for(var r=this.tryEntries.length-1;r>=0;--r){var e=this.tryEntries[r];if(e.tryLoc===t){var n=e.completion;if("throw"===n.type){var o=n.arg;S(e)}return o}}throw new Error("illegal catch attempt")},delegateYield:function(t,e,n){return this.delegate={iterator:P(t),resultName:e,nextLoc:n},"next"===this.method&&(this.arg=r),d}},t}(t.exports);try{regeneratorRuntime=r}catch(t){Function("r","regeneratorRuntime = r")(r)}})),a=Array.isArray,u="object"==e(n)&&n&&n.Object===Object&&n,c="object"==("undefined"==typeof self?"undefined":e(self))&&self&&self.Object===Object&&self,f=u||c||Function("return this")(),s=f.Symbol,l=Object.prototype,v=l.hasOwnProperty,p=l.toString,h=s?s.toStringTag:void 0;var y=function(t){var r=v.call(t,h),e=t[h];try{t[h]=void 0;var n=!0}catch(t){}var o=p.call(t);return n&&(r?t[h]=e:delete t[h]),o},d=Object.prototype.toString;var g=function(t){return d.call(t)},b=s?s.toStringTag:void 0;var m=function(t){return null==t?void 0===t?"[object Undefined]":"[object Null]":b&&b in Object(t)?y(t):g(t)};var _=function(t){return null!=t&&"object"==e(t)};var w=function(t){return"symbol"==e(t)||_(t)&&"[object Symbol]"==m(t)},j=/\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/,x=/^\w*$/;var O=function(t,r){if(a(t))return!1;var n=e(t);return!("number"!=n&&"symbol"!=n&&"boolean"!=n&&null!=t&&!w(t))||(x.test(t)||!j.test(t)||null!=r&&t in Object(r))};var T=function(t){var r=e(t);return null!=t&&("object"==r||"function"==r)};var L,E=function(t){if(!T(t))return!1;var r=m(t);return"[object Function]"==r||"[object GeneratorFunction]"==r||"[object AsyncFunction]"==r||"[object Proxy]"==r},S=f["__core-js_shared__"],A=(L=/[^.]+$/.exec(S&&S.keys&&S.keys.IE_PROTO||""))?"Symbol(src)_1."+L:"";var P=function(t){return!!A&&A in t},N=Function.prototype.toString;var k=function(t){if(null!=t){try{return N.call(t)}catch(t){}try{return t+""}catch(t){}}return""},F=/^\[object .+?Constructor\]$/,I=Function.prototype,C=Object.prototype,$=I.toString,z=C.hasOwnProperty,G=RegExp("^"+$.call(z).replace(/[\\^$.*+?()[\]{}|]/g,"\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g,"$1.*?")+"$");var R=function(t){return!(!T(t)||P(t))&&(E(t)?G:F).test(k(t))};var M=function(t,r){return null==t?void 0:t[r]};var D=function(t,r){var e=M(t,r);return R(e)?e:void 0},B=D(Object,"create");var U=function(){this.__data__=B?B(null):{},this.size=0};var W=function(t){var r=this.has(t)&&delete this.__data__[t];return this.size-=r?1:0,r},q=Object.prototype.hasOwnProperty;var Y=function(t){var r=this.__data__;if(B){var e=r[t];return"__lodash_hash_undefined__"===e?void 0:e}return q.call(r,t)?r[t]:void 0},V=Object.prototype.hasOwnProperty;var H=function(t){var r=this.__data__;return B?void 0!==r[t]:V.call(r,t)};var J=function(t,r){var e=this.__data__;return this.size+=this.has(t)?0:1,e[t]=B&&void 0===r?"__lodash_hash_undefined__":r,this};function K(t){var r=-1,e=null==t?0:t.length;for(this.clear();++r<e;){var n=t[r];this.set(n[0],n[1])}}K.prototype.clear=U,K.prototype.delete=W,K.prototype.get=Y,K.prototype.has=H,K.prototype.set=J;var Q=K;var X=function(){this.__data__=[],this.size=0};var Z=function(t,r){return t===r||t!=t&&r!=r};var tt=function(t,r){for(var e=t.length;e--;)if(Z(t[e][0],r))return e;return-1},rt=Array.prototype.splice;var et=function(t){var r=this.__data__,e=tt(r,t);return!(e<0)&&(e==r.length-1?r.pop():rt.call(r,e,1),--this.size,!0)};var nt=function(t){var r=this.__data__,e=tt(r,t);return e<0?void 0:r[e][1]};var ot=function(t){return tt(this.__data__,t)>-1};var it=function(t,r){var e=this.__data__,n=tt(e,t);return n<0?(++this.size,e.push([t,r])):e[n][1]=r,this};function at(t){var r=-1,e=null==t?0:t.length;for(this.clear();++r<e;){var n=t[r];this.set(n[0],n[1])}}at.prototype.clear=X,at.prototype.delete=et,at.prototype.get=nt,at.prototype.has=ot,at.prototype.set=it;var ut=at,ct=D(f,"Map");var ft=function(){this.size=0,this.__data__={hash:new Q,map:new(ct||ut),string:new Q}};var st=function(t){var r=e(t);return"string"==r||"number"==r||"symbol"==r||"boolean"==r?"__proto__"!==t:null===t};var lt=function(t,r){var e=t.__data__;return st(r)?e["string"==typeof r?"string":"hash"]:e.map};var vt=function(t){var r=lt(this,t).delete(t);return this.size-=r?1:0,r};var pt=function(t){return lt(this,t).get(t)};var ht=function(t){return lt(this,t).has(t)};var yt=function(t,r){var e=lt(this,t),n=e.size;return e.set(t,r),this.size+=e.size==n?0:1,this};function dt(t){var r=-1,e=null==t?0:t.length;for(this.clear();++r<e;){var n=t[r];this.set(n[0],n[1])}}dt.prototype.clear=ft,dt.prototype.delete=vt,dt.prototype.get=pt,dt.prototype.has=ht,dt.prototype.set=yt;var gt=dt;function bt(t,r){if("function"!=typeof t||null!=r&&"function"!=typeof r)throw new TypeError("Expected a function");var e=function e(){var n=arguments,o=r?r.apply(this,n):n[0],i=e.cache;if(i.has(o))return i.get(o);var a=t.apply(this,n);return e.cache=i.set(o,a)||i,a};return e.cache=new(bt.Cache||gt),e}bt.Cache=gt;var mt=bt;var _t=/[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g,wt=/\\(\\)?/g,jt=function(t){var r=mt(t,(function(t){return 500===e.size&&e.clear(),t})),e=r.cache;return r}((function(t){var r=[];return 46===t.charCodeAt(0)&&r.push(""),t.replace(_t,(function(t,e,n,o){r.push(n?o.replace(wt,"$1"):e||t)})),r}));var xt=function(t,r){for(var e=-1,n=null==t?0:t.length,o=Array(n);++e<n;)o[e]=r(t[e],e,t);return o},Ot=s?s.prototype:void 0,Tt=Ot?Ot.toString:void 0;var Lt=function t(r){if("string"==typeof r)return r;if(a(r))return xt(r,t)+"";if(w(r))return Tt?Tt.call(r):"";var e=r+"";return"0"==e&&1/r==-Infinity?"-0":e};var Et=function(t){return null==t?"":Lt(t)};var St=function(t,r){return a(t)?t:O(t,r)?[t]:jt(Et(t))};var At=function(t){if("string"==typeof t||w(t))return t;var r=t+"";return"0"==r&&1/t==-Infinity?"-0":r};var Pt=function(t,r){for(var e=0,n=(r=St(r,t)).length;null!=t&&e<n;)t=t[At(r[e++])];return e&&e==n?t:void 0};var Nt=function(t,r,e){var n=null==t?void 0:Pt(t,r);return void 0===n?e:n},kt=function(){try{var t=D(Object,"defineProperty");return t({},"",{}),t}catch(t){}}();var Ft=function(t,r,e){"__proto__"==r&&kt?kt(t,r,{configurable:!0,enumerable:!0,value:e,writable:!0}):t[r]=e},It=Object.prototype.hasOwnProperty;var Ct=function(t,r,e){var n=t[r];It.call(t,r)&&Z(n,e)&&(void 0!==e||r in t)||Ft(t,r,e)},$t=/^(?:0|[1-9]\d*)$/;var zt=function(t,r){var n=e(t);return!!(r=null==r?9007199254740991:r)&&("number"==n||"symbol"!=n&&$t.test(t))&&t>-1&&t%1==0&&t<r};var Gt=function(t,r,e,n){if(!T(t))return t;for(var o=-1,i=(r=St(r,t)).length,a=i-1,u=t;null!=u&&++o<i;){var c=At(r[o]),f=e;if("__proto__"===c||"constructor"===c||"prototype"===c)return t;if(o!=a){var s=u[c];void 0===(f=n?n(s,c,u):void 0)&&(f=T(s)?s:zt(r[o+1])?[]:{})}Ct(u,c,f),u=u[c]}return t};var Rt=function(t,r,e){return null==t?t:Gt(t,r,e)};var Mt=function(t,r){for(var e=-1,n=null==t?0:t.length;++e<n&&!1!==r(t[e],e,t););return t};var Dt=function(t){return function(r,e,n){for(var o=-1,i=Object(r),a=n(r),u=a.length;u--;){var c=a[t?u:++o];if(!1===e(i[c],c,i))break}return r}}();var Bt=function(t,r){for(var e=-1,n=Array(t);++e<t;)n[e]=r(e);return n};var Ut=function(t){return _(t)&&"[object Arguments]"==m(t)},Wt=Object.prototype,qt=Wt.hasOwnProperty,Yt=Wt.propertyIsEnumerable,Vt=Ut(function(){return arguments}())?Ut:function(t){return _(t)&&qt.call(t,"callee")&&!Yt.call(t,"callee")};var Ht=function(){return!1},Jt=o((function(t,r){var e=r&&!r.nodeType&&r,n=e&&t&&!t.nodeType&&t,o=n&&n.exports===e?f.Buffer:void 0,i=(o?o.isBuffer:void 0)||Ht;t.exports=i}));var Kt=function(t){return"number"==typeof t&&t>-1&&t%1==0&&t<=9007199254740991},Qt={};Qt["[object Float32Array]"]=Qt["[object Float64Array]"]=Qt["[object Int8Array]"]=Qt["[object Int16Array]"]=Qt["[object Int32Array]"]=Qt["[object Uint8Array]"]=Qt["[object Uint8ClampedArray]"]=Qt["[object Uint16Array]"]=Qt["[object Uint32Array]"]=!0,Qt["[object Arguments]"]=Qt["[object Array]"]=Qt["[object ArrayBuffer]"]=Qt["[object Boolean]"]=Qt["[object DataView]"]=Qt["[object Date]"]=Qt["[object Error]"]=Qt["[object Function]"]=Qt["[object Map]"]=Qt["[object Number]"]=Qt["[object Object]"]=Qt["[object RegExp]"]=Qt["[object Set]"]=Qt["[object String]"]=Qt["[object WeakMap]"]=!1;var Xt=function(t){return _(t)&&Kt(t.length)&&!!Qt[m(t)]};var Zt=function(t){return function(r){return t(r)}},tr=o((function(t,r){var e=r&&!r.nodeType&&r,n=e&&t&&!t.nodeType&&t,o=n&&n.exports===e&&u.process,i=function(){try{var t=n&&n.require&&n.require("util").types;return t||o&&o.binding&&o.binding("util")}catch(t){}}();t.exports=i})),rr=tr&&tr.isTypedArray,er=rr?Zt(rr):Xt,nr=Object.prototype.hasOwnProperty;var or=function(t,r){var e=a(t),n=!e&&Vt(t),o=!e&&!n&&Jt(t),i=!e&&!n&&!o&&er(t),u=e||n||o||i,c=u?Bt(t.length,String):[],f=c.length;for(var s in t)!r&&!nr.call(t,s)||u&&("length"==s||o&&("offset"==s||"parent"==s)||i&&("buffer"==s||"byteLength"==s||"byteOffset"==s)||zt(s,f))||c.push(s);return c},ir=Object.prototype;var ar=function(t){var r=t&&t.constructor;return t===("function"==typeof r&&r.prototype||ir)};var ur=function(t,r){return function(e){return t(r(e))}}(Object.keys,Object),cr=Object.prototype.hasOwnProperty;var fr=function(t){if(!ar(t))return ur(t);var r=[];for(var e in Object(t))cr.call(t,e)&&"constructor"!=e&&r.push(e);return r};var sr=function(t){return null!=t&&Kt(t.length)&&!E(t)};var lr=function(t){return sr(t)?or(t):fr(t)};var vr=function(t,r){return function(e,n){if(null==e)return e;if(!sr(e))return t(e,n);for(var o=e.length,i=r?o:-1,a=Object(e);(r?i--:++i<o)&&!1!==n(a[i],i,a););return e}}((function(t,r){return t&&Dt(t,r,lr)}));var pr=function(t){return t};var hr=function(t){return"function"==typeof t?t:pr};var yr=function(t,r){return(a(t)?Mt:vr)(t,hr(r))};function dr(){var t,r,e=new Promise((function(){t=arguments[0],r=arguments[1]}));return e.resolve=t,e.reject=r,e}var gr=o((function(t){var r=Object.prototype.hasOwnProperty,e="~";function n(){}function o(t,r,e){this.fn=t,this.context=r,this.once=e||!1}function i(t,r,n,i,a){if("function"!=typeof n)throw new TypeError("The listener must be a function");var u=new o(n,i||t,a),c=e?e+r:r;return t._events[c]?t._events[c].fn?t._events[c]=[t._events[c],u]:t._events[c].push(u):(t._events[c]=u,t._eventsCount++),t}function a(t,r){0==--t._eventsCount?t._events=new n:delete t._events[r]}function u(){this._events=new n,this._eventsCount=0}Object.create&&(n.prototype=Object.create(null),(new n).__proto__||(e=!1)),u.prototype.eventNames=function(){var t,n,o=[];if(0===this._eventsCount)return o;for(n in t=this._events)r.call(t,n)&&o.push(e?n.slice(1):n);return Object.getOwnPropertySymbols?o.concat(Object.getOwnPropertySymbols(t)):o},u.prototype.listeners=function(t){var r=e?e+t:t,n=this._events[r];if(!n)return[];if(n.fn)return[n.fn];for(var o=0,i=n.length,a=new Array(i);o<i;o++)a[o]=n[o].fn;return a},u.prototype.listenerCount=function(t){var r=e?e+t:t,n=this._events[r];return n?n.fn?1:n.length:0},u.prototype.emit=function(t,r,n,o,i,a){var u=e?e+t:t;if(!this._events[u])return!1;var c,f,s=this._events[u],l=arguments.length;if(s.fn){switch(s.once&&this.removeListener(t,s.fn,void 0,!0),l){case 1:return s.fn.call(s.context),!0;case 2:return s.fn.call(s.context,r),!0;case 3:return s.fn.call(s.context,r,n),!0;case 4:return s.fn.call(s.context,r,n,o),!0;case 5:return s.fn.call(s.context,r,n,o,i),!0;case 6:return s.fn.call(s.context,r,n,o,i,a),!0}for(f=1,c=new Array(l-1);f<l;f++)c[f-1]=arguments[f];s.fn.apply(s.context,c)}else{var v,p=s.length;for(f=0;f<p;f++)switch(s[f].once&&this.removeListener(t,s[f].fn,void 0,!0),l){case 1:s[f].fn.call(s[f].context);break;case 2:s[f].fn.call(s[f].context,r);break;case 3:s[f].fn.call(s[f].context,r,n);break;case 4:s[f].fn.call(s[f].context,r,n,o);break;default:if(!c)for(v=1,c=new Array(l-1);v<l;v++)c[v-1]=arguments[v];s[f].fn.apply(s[f].context,c)}}return!0},u.prototype.on=function(t,r,e){return i(this,t,r,e,!1)},u.prototype.once=function(t,r,e){return i(this,t,r,e,!0)},u.prototype.removeListener=function(t,r,n,o){var i=e?e+t:t;if(!this._events[i])return this;if(!r)return a(this,i),this;var u=this._events[i];if(u.fn)u.fn!==r||o&&!u.once||n&&u.context!==n||a(this,i);else{for(var c=0,f=[],s=u.length;c<s;c++)(u[c].fn!==r||o&&!u[c].once||n&&u[c].context!==n)&&f.push(u[c]);f.length?this._events[i]=1===f.length?f[0]:f:a(this,i)}return this},u.prototype.removeAllListeners=function(t){var r;return t?(r=e?e+t:t,this._events[r]&&a(this,r)):(this._events=new n,this._eventsCount=0),this},u.prototype.off=u.prototype.removeListener,u.prototype.addListener=u.prototype.on,u.prefixed=e,u.EventEmitter=u,t.exports=u}));function br(){return new gr}function mr(t){if(function(t){return"[object Object]"===Object.prototype.toString.call(t)}(t)){for(var r in t)return!0;return!1}return!1}function _r(t){var r=Object.prototype.toString.call(t);return"[object Function]"===r||"[object AsyncFunction]"===r}var wr=/\s/;var jr=function(t){for(var r=t.length;r--&&wr.test(t.charAt(r)););return r},xr=/^\s+/;var Or=function(t){return t?t.slice(0,jr(t)+1).replace(xr,""):t},Tr=/^[-+]0x[0-9a-f]+$/i,Lr=/^0b[01]+$/i,Er=/^0o[0-7]+$/i,Sr=parseInt;var Ar=function(t){if("number"==typeof t)return t;if(w(t))return NaN;if(T(t)){var r="function"==typeof t.valueOf?t.valueOf():t;t=T(r)?r+"":r}if("string"!=typeof t)return 0===t?t:+t;t=Or(t);var e=Lr.test(t);return e||Er.test(t)?Sr(t.slice(2),e?2:8):Tr.test(t)?NaN:+t},Pr=1/0;var Nr=function(t){return t?(t=Ar(t))===Pr||t===-1/0?17976931348623157e292*(t<0?-1:1):t==t?t:0:0===t?t:0};var kr=function(t){var r=Nr(t),e=r%1;return r==r?e?r-e:r:0},Fr=f.isFinite,Ir=Math.min;var Cr=function(t){var r=Math[t];return function(t,e){if(t=Ar(t),(e=null==e?0:Ir(kr(e),292))&&Fr(t)){var n=(Et(t)+"e").split("e"),o=r(n[0]+"e"+(+n[1]+e));return+((n=(Et(o)+"e").split("e"))[0]+"e"+(+n[1]-e))}return r(t)}}("round");function $r(t){return!(!function(t){return"[object String]"===Object.prototype.toString.call(t)}(t)||""===t)}function zr(t){var r=!1;return $r(t)?r=!isNaN(Number(t)):function(t){return"[object Number]"===Object.prototype.toString.call(t)}(t)&&(r=!0),r}function Gr(t){if(!zr(t))return 0;t=function(t){return zr(t)?Nr(t):0}(t);var r=Cr(t);return"0"===String(r)?0:r}var Rr=function(t){return Et(t).toLowerCase()};var Mr=function(t,r,e){var n=-1,o=t.length;r<0&&(r=-r>o?0:o+r),(e=e>o?o:e)<0&&(e+=o),o=r>e?0:e-r>>>0,r>>>=0;for(var i=Array(o);++n<o;)i[n]=t[n+r];return i};var Dr=function(t,r,e){var n=t.length;return e=void 0===e?n:e,!r&&e>=n?t:Mr(t,r,e)};var Br=function(t,r,e,n){for(var o=t.length,i=e+(n?1:-1);n?i--:++i<o;)if(r(t[i],i,t))return i;return-1};var Ur=function(t){return t!=t};var Wr=function(t,r,e){for(var n=e-1,o=t.length;++n<o;)if(t[n]===r)return n;return-1};var qr=function(t,r,e){return r==r?Wr(t,r,e):Br(t,Ur,e)};var Yr=function(t,r){for(var e=t.length;e--&&qr(r,t[e],0)>-1;);return e};var Vr=function(t,r){for(var e=-1,n=t.length;++e<n&&qr(r,t[e],0)>-1;);return e};var Hr=function(t){return t.split("")},Jr=RegExp("[\\u200d\\ud800-\\udfff\\u0300-\\u036f\\ufe20-\\ufe2f\\u20d0-\\u20ff\\ufe0e\\ufe0f]");var Kr=function(t){return Jr.test(t)},Qr="[\\ud800-\\udfff]",Xr="[\\u0300-\\u036f\\ufe20-\\ufe2f\\u20d0-\\u20ff]",Zr="\\ud83c[\\udffb-\\udfff]",te="[^\\ud800-\\udfff]",re="(?:\\ud83c[\\udde6-\\uddff]){2}",ee="[\\ud800-\\udbff][\\udc00-\\udfff]",ne="(?:"+Xr+"|"+Zr+")"+"?",oe="[\\ufe0e\\ufe0f]?",ie=oe+ne+("(?:\\u200d(?:"+[te,re,ee].join("|")+")"+oe+ne+")*"),ae="(?:"+[te+Xr+"?",Xr,re,ee,Qr].join("|")+")",ue=RegExp(Zr+"(?="+Zr+")|"+ae+ie,"g");var ce=function(t){return t.match(ue)||[]};var fe=function(t){return Kr(t)?ce(t):Hr(t)};var se=function(t,r,e){if((t=Et(t))&&(e||void 0===r))return Or(t);if(!t||!(r=Lt(r)))return t;var n=fe(t),o=fe(r),i=Vr(n,o),a=Yr(n,o)+1;return Dr(n,i,a).join("")};var le=function(t){return!0===t||!1===t||_(t)&&"[object Boolean]"==m(t)};function ve(t){if(function(t){return le(t)}(t))return t;if(0===t)return!1;if(1===t)return!0;var r=!1;return $r(t)&&"true"===(t=Rr(se(t)))&&(r=!0),r}function pe(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:10;zr(t)||(t=10);var r=dr();return setTimeout((function(){r.resolve()}),t),r}function he(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},e={},n=!1;t.usePollingTableTags?t.usePollingTableTags=ve(t.usePollingTableTags):t.usePollingTableTags=!1,t.pollingIntervalTime?t.pollingIntervalTime=Gr(t.pollingIntervalTime):t.pollingIntervalTime=2e3;var o=new br;function a(t){for(var r=arguments.length,e=new Array(r>1?r-1:0),n=1;n<r;n++)e[n-1]=arguments[n];setTimeout((function(){o.emit.apply(o,[t].concat(e))}),1)}function u(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{};e=t}function c(){return f.apply(this,arguments)}function f(){return(f=r(i.mark((function t(){var r,n,o=arguments;return i.wrap((function(t){for(;;)switch(t.prev=t.next){case 0:return r=o.length>0&&void 0!==o[0]?o[0]:{},n=[],yr(r,(function(t,r){if(e[r]!==t){var o=dr(),i={tableName:r,timeTag:t,pm:o};n.push(o),a("refreshTable",i),o.then((function(n){e[r]=t,a("getData",{tableName:r,timeTag:t,data:n})})).catch((function(t){a("error",{msg:"can not get table data: "+r,err:t})}))}})),t.next=5,Promise.all(n);case 5:case"end":return t.stop()}}),t)})))).apply(this,arguments)}function s(){return l.apply(this,arguments)}function l(){return(l=r(i.mark((function r(){var e,o;return i.wrap((function(r){for(;;)switch(r.prev=r.next){case 0:if(!n){r.next=2;break}return r.abrupt("return");case 2:return n=!0,a("refreshTags",{pm:e=dr()}),r.next=7,e.catch((function(t){a("error",{msg:"can not get tags data",err:t})}));case 7:if(!(o=r.sent)){r.next=11;break}return r.next=11,c(o);case 11:return r.next=13,pe(t.pollingIntervalTime);case 13:n=!1;case 14:case"end":return r.stop()}}),r)})))).apply(this,arguments)}return t.usePollingTableTags&&"undefined"!=typeof window&&window.addEventListener("mouseover",(function(t){s()}),!1),o.setTableTags=u,o.updateTableTags=c,o.pollingTableTags=s,o}return function(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},e={},n=br(),o=Nt(t,"instWConverClient",null);if(null===o)return n.emit("error","invalid opt.instWConverClient"),n;var a=Nt(t,"cbGetToken",null);_r(a)||(a=function(){return""});var u=function(){var t=a();return void 0===t&&(t=""),t},c=Nt(t,"cbGetServerMethods",null);if(!_r(c))return n.emit("error","invalid opt.cbGetServerMethods"),n;var f=Nt(t,"cbRecvData",null);if(!_r(f))return n.emit("error","invalid opt.cbRecvData"),n;var s=he();function l(t){function e(){return(e=r(i.mark((function r(){var e,n,a=arguments;return i.wrap((function(r){for(;;)switch(r.prev=r.next){case 0:return e=dr(),n={__sysInputArgs__:Array.prototype.slice.call(a),__sysToken__:u()},r.next=4,o.execute(t,n).then((function(t){var r=t.msg;"success"===t.state?e.resolve(r):e.reject(r)})).catch((function(t){e.reject(t)}));case 4:return r.abrupt("return",e);case 5:case"end":return r.stop()}}),r)})))).apply(this,arguments)}return function(){return e.apply(this,arguments)}}function v(t){e={},yr(t,(function(t){Rt(e,t,l(t))})),c(e)}function p(t){"syncTable"===Nt(t,"mode")&&s.updateTableTags(Nt(t,"data"))}return o.on("openOnce",(function(){l("getFuncList")().then((function(t){v(t)})).catch((function(t){n.emit("error",t)}))})),o.on("broadcast",(function(t){p(t)})),o.on("deliver",(function(t){p(t)})),s.on("refreshTable",(function(t){mr(e[t.tableName])?e[t.tableName].select().then((function(r){t.pm.resolve(r)})).catch((function(r){console.log("".concat(t.tableName,".select: catch"),r)})):n.emit("error","無法存取".concat(t.tableName,"資料表"))})),s.on("getData",(function(t){f(t)})),s.on("error",(function(t){n.emit("error",t)})),n}}));
//# sourceMappingURL=w-serv-webdata-client.umd.js.map
