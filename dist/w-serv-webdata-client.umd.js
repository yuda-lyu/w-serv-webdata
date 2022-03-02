/*!
 * w-serv-webdata-client v1.0.22
 * (c) 2018-2021 yuda-lyu(semisphere)
 * Released under the MIT License.
 */
!function(t,e){"object"==typeof exports&&"undefined"!=typeof module?module.exports=e():"function"==typeof define&&define.amd?define(e):(t="undefined"!=typeof globalThis?globalThis:t||self)["w-serv-webdata-client"]=e()}(this,(function(){"use strict";function t(t,e,r,n,o,a,i){try{var u=t[a](i),c=u.value}catch(t){return void r(t)}u.done?e(c):Promise.resolve(c).then(n,o)}function e(e){return function(){var r=this,n=arguments;return new Promise((function(o,a){var i=e.apply(r,n);function u(e){t(i,o,a,u,c,"next",e)}function c(e){t(i,o,a,u,c,"throw",e)}u(void 0)}))}}function r(t){return(r="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t})(t)}var n="undefined"!=typeof globalThis?globalThis:"undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof self?self:{};function o(t){var e={exports:{}};return t(e,e.exports),e.exports}var a=o((function(t){var e=function(t){var e,n=Object.prototype,o=n.hasOwnProperty,a="function"==typeof Symbol?Symbol:{},i=a.iterator||"@@iterator",u=a.asyncIterator||"@@asyncIterator",c=a.toStringTag||"@@toStringTag";function f(t,e,r){return Object.defineProperty(t,e,{value:r,enumerable:!0,configurable:!0,writable:!0}),t[e]}try{f({},"")}catch(t){f=function(t,e,r){return t[e]=r}}function s(t,e,r,n){var o=e&&e.prototype instanceof d?e:d,a=Object.create(o.prototype),i=new E(n||[]);return a._invoke=function(t,e,r){var n=v;return function(o,a){if(n===h)throw new Error("Generator is already running");if(n===y){if("throw"===o)throw a;return k()}for(r.method=o,r.arg=a;;){var i=r.delegate;if(i){var u=A(i,r);if(u){if(u===b)continue;return u}}if("next"===r.method)r.sent=r._sent=r.arg;else if("throw"===r.method){if(n===v)throw n=y,r.arg;r.dispatchException(r.arg)}else"return"===r.method&&r.abrupt("return",r.arg);n=h;var c=l(t,e,r);if("normal"===c.type){if(n=r.done?y:p,c.arg===b)continue;return{value:c.arg,done:r.done}}"throw"===c.type&&(n=y,r.method="throw",r.arg=c.arg)}}}(t,r,i),a}function l(t,e,r){try{return{type:"normal",arg:t.call(e,r)}}catch(t){return{type:"throw",arg:t}}}t.wrap=s;var v="suspendedStart",p="suspendedYield",h="executing",y="completed",b={};function d(){}function g(){}function j(){}var _={};_[i]=function(){return this};var m=Object.getPrototypeOf,w=m&&m(m(L([])));w&&w!==n&&o.call(w,i)&&(_=w);var T=j.prototype=d.prototype=Object.create(_);function O(t){["next","throw","return"].forEach((function(e){f(t,e,(function(t){return this._invoke(e,t)}))}))}function x(t,e){function n(a,i,u,c){var f=l(t[a],t,i);if("throw"!==f.type){var s=f.arg,v=s.value;return v&&"object"===r(v)&&o.call(v,"__await")?e.resolve(v.__await).then((function(t){n("next",t,u,c)}),(function(t){n("throw",t,u,c)})):e.resolve(v).then((function(t){s.value=t,u(s)}),(function(t){return n("throw",t,u,c)}))}c(f.arg)}var a;this._invoke=function(t,r){function o(){return new e((function(e,o){n(t,r,e,o)}))}return a=a?a.then(o,o):o()}}function A(t,r){var n=t.iterator[r.method];if(n===e){if(r.delegate=null,"throw"===r.method){if(t.iterator.return&&(r.method="return",r.arg=e,A(t,r),"throw"===r.method))return b;r.method="throw",r.arg=new TypeError("The iterator does not provide a 'throw' method")}return b}var o=l(n,t.iterator,r.arg);if("throw"===o.type)return r.method="throw",r.arg=o.arg,r.delegate=null,b;var a=o.arg;return a?a.done?(r[t.resultName]=a.value,r.next=t.nextLoc,"return"!==r.method&&(r.method="next",r.arg=e),r.delegate=null,b):a:(r.method="throw",r.arg=new TypeError("iterator result is not an object"),r.delegate=null,b)}function S(t){var e={tryLoc:t[0]};1 in t&&(e.catchLoc=t[1]),2 in t&&(e.finallyLoc=t[2],e.afterLoc=t[3]),this.tryEntries.push(e)}function P(t){var e=t.completion||{};e.type="normal",delete e.arg,t.completion=e}function E(t){this.tryEntries=[{tryLoc:"root"}],t.forEach(S,this),this.reset(!0)}function L(t){if(t){var r=t[i];if(r)return r.call(t);if("function"==typeof t.next)return t;if(!isNaN(t.length)){var n=-1,a=function r(){for(;++n<t.length;)if(o.call(t,n))return r.value=t[n],r.done=!1,r;return r.value=e,r.done=!0,r};return a.next=a}}return{next:k}}function k(){return{value:e,done:!0}}return g.prototype=T.constructor=j,j.constructor=g,g.displayName=f(j,c,"GeneratorFunction"),t.isGeneratorFunction=function(t){var e="function"==typeof t&&t.constructor;return!!e&&(e===g||"GeneratorFunction"===(e.displayName||e.name))},t.mark=function(t){return Object.setPrototypeOf?Object.setPrototypeOf(t,j):(t.__proto__=j,f(t,c,"GeneratorFunction")),t.prototype=Object.create(T),t},t.awrap=function(t){return{__await:t}},O(x.prototype),x.prototype[u]=function(){return this},t.AsyncIterator=x,t.async=function(e,r,n,o,a){void 0===a&&(a=Promise);var i=new x(s(e,r,n,o),a);return t.isGeneratorFunction(r)?i:i.next().then((function(t){return t.done?t.value:i.next()}))},O(T),f(T,c,"Generator"),T[i]=function(){return this},T.toString=function(){return"[object Generator]"},t.keys=function(t){var e=[];for(var r in t)e.push(r);return e.reverse(),function r(){for(;e.length;){var n=e.pop();if(n in t)return r.value=n,r.done=!1,r}return r.done=!0,r}},t.values=L,E.prototype={constructor:E,reset:function(t){if(this.prev=0,this.next=0,this.sent=this._sent=e,this.done=!1,this.delegate=null,this.method="next",this.arg=e,this.tryEntries.forEach(P),!t)for(var r in this)"t"===r.charAt(0)&&o.call(this,r)&&!isNaN(+r.slice(1))&&(this[r]=e)},stop:function(){this.done=!0;var t=this.tryEntries[0].completion;if("throw"===t.type)throw t.arg;return this.rval},dispatchException:function(t){if(this.done)throw t;var r=this;function n(n,o){return u.type="throw",u.arg=t,r.next=n,o&&(r.method="next",r.arg=e),!!o}for(var a=this.tryEntries.length-1;a>=0;--a){var i=this.tryEntries[a],u=i.completion;if("root"===i.tryLoc)return n("end");if(i.tryLoc<=this.prev){var c=o.call(i,"catchLoc"),f=o.call(i,"finallyLoc");if(c&&f){if(this.prev<i.catchLoc)return n(i.catchLoc,!0);if(this.prev<i.finallyLoc)return n(i.finallyLoc)}else if(c){if(this.prev<i.catchLoc)return n(i.catchLoc,!0)}else{if(!f)throw new Error("try statement without catch or finally");if(this.prev<i.finallyLoc)return n(i.finallyLoc)}}}},abrupt:function(t,e){for(var r=this.tryEntries.length-1;r>=0;--r){var n=this.tryEntries[r];if(n.tryLoc<=this.prev&&o.call(n,"finallyLoc")&&this.prev<n.finallyLoc){var a=n;break}}a&&("break"===t||"continue"===t)&&a.tryLoc<=e&&e<=a.finallyLoc&&(a=null);var i=a?a.completion:{};return i.type=t,i.arg=e,a?(this.method="next",this.next=a.finallyLoc,b):this.complete(i)},complete:function(t,e){if("throw"===t.type)throw t.arg;return"break"===t.type||"continue"===t.type?this.next=t.arg:"return"===t.type?(this.rval=this.arg=t.arg,this.method="return",this.next="end"):"normal"===t.type&&e&&(this.next=e),b},finish:function(t){for(var e=this.tryEntries.length-1;e>=0;--e){var r=this.tryEntries[e];if(r.finallyLoc===t)return this.complete(r.completion,r.afterLoc),P(r),b}},catch:function(t){for(var e=this.tryEntries.length-1;e>=0;--e){var r=this.tryEntries[e];if(r.tryLoc===t){var n=r.completion;if("throw"===n.type){var o=n.arg;P(r)}return o}}throw new Error("illegal catch attempt")},delegateYield:function(t,r,n){return this.delegate={iterator:L(t),resultName:r,nextLoc:n},"next"===this.method&&(this.arg=e),b}},t}(t.exports);try{regeneratorRuntime=e}catch(t){Function("r","regeneratorRuntime = r")(e)}})),i=Array.isArray,u="object"==r(n)&&n&&n.Object===Object&&n,c="object"==("undefined"==typeof self?"undefined":r(self))&&self&&self.Object===Object&&self,f=u||c||Function("return this")(),s=f.Symbol,l=Object.prototype,v=l.hasOwnProperty,p=l.toString,h=s?s.toStringTag:void 0;var y=function(t){var e=v.call(t,h),r=t[h];try{t[h]=void 0;var n=!0}catch(t){}var o=p.call(t);return n&&(e?t[h]=r:delete t[h]),o},b=Object.prototype.toString;var d=function(t){return b.call(t)},g=s?s.toStringTag:void 0;var j=function(t){return null==t?void 0===t?"[object Undefined]":"[object Null]":g&&g in Object(t)?y(t):d(t)};var _=function(t){return null!=t&&"object"==r(t)};var m=function(t){return"symbol"==r(t)||_(t)&&"[object Symbol]"==j(t)},w=/\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/,T=/^\w*$/;var O=function(t,e){if(i(t))return!1;var n=r(t);return!("number"!=n&&"symbol"!=n&&"boolean"!=n&&null!=t&&!m(t))||(T.test(t)||!w.test(t)||null!=e&&t in Object(e))};var x=function(t){var e=r(t);return null!=t&&("object"==e||"function"==e)};var A,S=function(t){if(!x(t))return!1;var e=j(t);return"[object Function]"==e||"[object GeneratorFunction]"==e||"[object AsyncFunction]"==e||"[object Proxy]"==e},P=f["__core-js_shared__"],E=(A=/[^.]+$/.exec(P&&P.keys&&P.keys.IE_PROTO||""))?"Symbol(src)_1."+A:"";var L=function(t){return!!E&&E in t},k=Function.prototype.toString;var N=function(t){if(null!=t){try{return k.call(t)}catch(t){}try{return t+""}catch(t){}}return""},F=/^\[object .+?Constructor\]$/,I=Function.prototype,z=Object.prototype,U=I.toString,C=z.hasOwnProperty,G=RegExp("^"+U.call(C).replace(/[\\^$.*+?()[\]{}|]/g,"\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g,"$1.*?")+"$");var M=function(t){return!(!x(t)||L(t))&&(S(t)?G:F).test(N(t))};var R=function(t,e){return null==t?void 0:t[e]};var $=function(t,e){var r=R(t,e);return M(r)?r:void 0},B=$(Object,"create");var D=function(){this.__data__=B?B(null):{},this.size=0};var W=function(t){var e=this.has(t)&&delete this.__data__[t];return this.size-=e?1:0,e},V=Object.prototype.hasOwnProperty;var q=function(t){var e=this.__data__;if(B){var r=e[t];return"__lodash_hash_undefined__"===r?void 0:r}return V.call(e,t)?e[t]:void 0},Y=Object.prototype.hasOwnProperty;var H=function(t){var e=this.__data__;return B?void 0!==e[t]:Y.call(e,t)};var J=function(t,e){var r=this.__data__;return this.size+=this.has(t)?0:1,r[t]=B&&void 0===e?"__lodash_hash_undefined__":e,this};function K(t){var e=-1,r=null==t?0:t.length;for(this.clear();++e<r;){var n=t[e];this.set(n[0],n[1])}}K.prototype.clear=D,K.prototype.delete=W,K.prototype.get=q,K.prototype.has=H,K.prototype.set=J;var Q=K;var X=function(){this.__data__=[],this.size=0};var Z=function(t,e){return t===e||t!=t&&e!=e};var tt=function(t,e){for(var r=t.length;r--;)if(Z(t[r][0],e))return r;return-1},et=Array.prototype.splice;var rt=function(t){var e=this.__data__,r=tt(e,t);return!(r<0)&&(r==e.length-1?e.pop():et.call(e,r,1),--this.size,!0)};var nt=function(t){var e=this.__data__,r=tt(e,t);return r<0?void 0:e[r][1]};var ot=function(t){return tt(this.__data__,t)>-1};var at=function(t,e){var r=this.__data__,n=tt(r,t);return n<0?(++this.size,r.push([t,e])):r[n][1]=e,this};function it(t){var e=-1,r=null==t?0:t.length;for(this.clear();++e<r;){var n=t[e];this.set(n[0],n[1])}}it.prototype.clear=X,it.prototype.delete=rt,it.prototype.get=nt,it.prototype.has=ot,it.prototype.set=at;var ut=it,ct=$(f,"Map");var ft=function(){this.size=0,this.__data__={hash:new Q,map:new(ct||ut),string:new Q}};var st=function(t){var e=r(t);return"string"==e||"number"==e||"symbol"==e||"boolean"==e?"__proto__"!==t:null===t};var lt=function(t,e){var r=t.__data__;return st(e)?r["string"==typeof e?"string":"hash"]:r.map};var vt=function(t){var e=lt(this,t).delete(t);return this.size-=e?1:0,e};var pt=function(t){return lt(this,t).get(t)};var ht=function(t){return lt(this,t).has(t)};var yt=function(t,e){var r=lt(this,t),n=r.size;return r.set(t,e),this.size+=r.size==n?0:1,this};function bt(t){var e=-1,r=null==t?0:t.length;for(this.clear();++e<r;){var n=t[e];this.set(n[0],n[1])}}bt.prototype.clear=ft,bt.prototype.delete=vt,bt.prototype.get=pt,bt.prototype.has=ht,bt.prototype.set=yt;var dt=bt;function gt(t,e){if("function"!=typeof t||null!=e&&"function"!=typeof e)throw new TypeError("Expected a function");var r=function r(){var n=arguments,o=e?e.apply(this,n):n[0],a=r.cache;if(a.has(o))return a.get(o);var i=t.apply(this,n);return r.cache=a.set(o,i)||a,i};return r.cache=new(gt.Cache||dt),r}gt.Cache=dt;var jt=gt;var _t=/[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g,mt=/\\(\\)?/g,wt=function(t){var e=jt(t,(function(t){return 500===r.size&&r.clear(),t})),r=e.cache;return e}((function(t){var e=[];return 46===t.charCodeAt(0)&&e.push(""),t.replace(_t,(function(t,r,n,o){e.push(n?o.replace(mt,"$1"):r||t)})),e}));var Tt=function(t,e){for(var r=-1,n=null==t?0:t.length,o=Array(n);++r<n;)o[r]=e(t[r],r,t);return o},Ot=s?s.prototype:void 0,xt=Ot?Ot.toString:void 0;var At=function t(e){if("string"==typeof e)return e;if(i(e))return Tt(e,t)+"";if(m(e))return xt?xt.call(e):"";var r=e+"";return"0"==r&&1/e==-Infinity?"-0":r};var St=function(t){return null==t?"":At(t)};var Pt=function(t,e){return i(t)?t:O(t,e)?[t]:wt(St(t))};var Et=function(t){if("string"==typeof t||m(t))return t;var e=t+"";return"0"==e&&1/t==-Infinity?"-0":e};var Lt=function(t,e){for(var r=0,n=(e=Pt(e,t)).length;null!=t&&r<n;)t=t[Et(e[r++])];return r&&r==n?t:void 0};var kt=function(t,e,r){var n=null==t?void 0:Lt(t,e);return void 0===n?r:n},Nt=function(){try{var t=$(Object,"defineProperty");return t({},"",{}),t}catch(t){}}();var Ft=function(t,e,r){"__proto__"==e&&Nt?Nt(t,e,{configurable:!0,enumerable:!0,value:r,writable:!0}):t[e]=r},It=Object.prototype.hasOwnProperty;var zt=function(t,e,r){var n=t[e];It.call(t,e)&&Z(n,r)&&(void 0!==r||e in t)||Ft(t,e,r)},Ut=/^(?:0|[1-9]\d*)$/;var Ct=function(t,e){var n=r(t);return!!(e=null==e?9007199254740991:e)&&("number"==n||"symbol"!=n&&Ut.test(t))&&t>-1&&t%1==0&&t<e};var Gt=function(t,e,r,n){if(!x(t))return t;for(var o=-1,a=(e=Pt(e,t)).length,i=a-1,u=t;null!=u&&++o<a;){var c=Et(e[o]),f=r;if("__proto__"===c||"constructor"===c||"prototype"===c)return t;if(o!=i){var s=u[c];void 0===(f=n?n(s,c,u):void 0)&&(f=x(s)?s:Ct(e[o+1])?[]:{})}zt(u,c,f),u=u[c]}return t};var Mt=function(t,e,r){return null==t?t:Gt(t,e,r)};var Rt=function(t,e){for(var r=-1,n=null==t?0:t.length;++r<n&&!1!==e(t[r],r,t););return t};var $t=function(t){return function(e,r,n){for(var o=-1,a=Object(e),i=n(e),u=i.length;u--;){var c=i[t?u:++o];if(!1===r(a[c],c,a))break}return e}}();var Bt=function(t,e){for(var r=-1,n=Array(t);++r<t;)n[r]=e(r);return n};var Dt=function(t){return _(t)&&"[object Arguments]"==j(t)},Wt=Object.prototype,Vt=Wt.hasOwnProperty,qt=Wt.propertyIsEnumerable,Yt=Dt(function(){return arguments}())?Dt:function(t){return _(t)&&Vt.call(t,"callee")&&!qt.call(t,"callee")};var Ht=function(){return!1},Jt=o((function(t,e){var r=e&&!e.nodeType&&e,n=r&&t&&!t.nodeType&&t,o=n&&n.exports===r?f.Buffer:void 0,a=(o?o.isBuffer:void 0)||Ht;t.exports=a}));var Kt=function(t){return"number"==typeof t&&t>-1&&t%1==0&&t<=9007199254740991},Qt={};Qt["[object Float32Array]"]=Qt["[object Float64Array]"]=Qt["[object Int8Array]"]=Qt["[object Int16Array]"]=Qt["[object Int32Array]"]=Qt["[object Uint8Array]"]=Qt["[object Uint8ClampedArray]"]=Qt["[object Uint16Array]"]=Qt["[object Uint32Array]"]=!0,Qt["[object Arguments]"]=Qt["[object Array]"]=Qt["[object ArrayBuffer]"]=Qt["[object Boolean]"]=Qt["[object DataView]"]=Qt["[object Date]"]=Qt["[object Error]"]=Qt["[object Function]"]=Qt["[object Map]"]=Qt["[object Number]"]=Qt["[object Object]"]=Qt["[object RegExp]"]=Qt["[object Set]"]=Qt["[object String]"]=Qt["[object WeakMap]"]=!1;var Xt=function(t){return _(t)&&Kt(t.length)&&!!Qt[j(t)]};var Zt=function(t){return function(e){return t(e)}},te=o((function(t,e){var r=e&&!e.nodeType&&e,n=r&&t&&!t.nodeType&&t,o=n&&n.exports===r&&u.process,a=function(){try{var t=n&&n.require&&n.require("util").types;return t||o&&o.binding&&o.binding("util")}catch(t){}}();t.exports=a})),ee=te&&te.isTypedArray,re=ee?Zt(ee):Xt,ne=Object.prototype.hasOwnProperty;var oe=function(t,e){var r=i(t),n=!r&&Yt(t),o=!r&&!n&&Jt(t),a=!r&&!n&&!o&&re(t),u=r||n||o||a,c=u?Bt(t.length,String):[],f=c.length;for(var s in t)!e&&!ne.call(t,s)||u&&("length"==s||o&&("offset"==s||"parent"==s)||a&&("buffer"==s||"byteLength"==s||"byteOffset"==s)||Ct(s,f))||c.push(s);return c},ae=Object.prototype;var ie=function(t){var e=t&&t.constructor;return t===("function"==typeof e&&e.prototype||ae)};var ue=function(t,e){return function(r){return t(e(r))}},ce=ue(Object.keys,Object),fe=Object.prototype.hasOwnProperty;var se=function(t){if(!ie(t))return ce(t);var e=[];for(var r in Object(t))fe.call(t,r)&&"constructor"!=r&&e.push(r);return e};var le=function(t){return null!=t&&Kt(t.length)&&!S(t)};var ve=function(t){return le(t)?oe(t):se(t)};var pe=function(t,e){return function(r,n){if(null==r)return r;if(!le(r))return t(r,n);for(var o=r.length,a=e?o:-1,i=Object(r);(e?a--:++a<o)&&!1!==n(i[a],a,i););return r}}((function(t,e){return t&&$t(t,e,ve)}));var he=function(t){return t};var ye=function(t){return"function"==typeof t?t:he};var be=function(t,e){return(i(t)?Rt:pe)(t,ye(e))};var de=function(t){var e=null==t?0:t.length;return e?t[e-1]:void 0};var ge=function(t,e,r){var n=-1,o=t.length;e<0&&(e=-e>o?0:o+e),(r=r>o?o:r)<0&&(r+=o),o=e>r?0:r-e>>>0,e>>>=0;for(var a=Array(o);++n<o;)a[n]=t[n+e];return a},je=/\s/;var _e=function(t){for(var e=t.length;e--&&je.test(t.charAt(e)););return e},me=/^\s+/;var we=function(t){return t?t.slice(0,_e(t)+1).replace(me,""):t},Te=/^[-+]0x[0-9a-f]+$/i,Oe=/^0b[01]+$/i,xe=/^0o[0-7]+$/i,Ae=parseInt;var Se=function(t){if("number"==typeof t)return t;if(m(t))return NaN;if(x(t)){var e="function"==typeof t.valueOf?t.valueOf():t;t=x(e)?e+"":e}if("string"!=typeof t)return 0===t?t:+t;t=we(t);var r=Oe.test(t);return r||xe.test(t)?Ae(t.slice(2),r?2:8):Te.test(t)?NaN:+t},Pe=1/0;var Ee=function(t){return t?(t=Se(t))===Pe||t===-1/0?17976931348623157e292*(t<0?-1:1):t==t?t:0:0===t?t:0};var Le=function(t){var e=Ee(t),r=e%1;return e==e?r?e-r:e:0};var ke=function(t,e,r){var n=null==t?0:t.length;return n?(e=r||void 0===e?1:Le(e),ge(t,0,(e=n-e)<0?0:e)):[]};function Ne(){var t,e,r=new Promise((function(){t=arguments[0],e=arguments[1]}));return r.resolve=t,r.reject=e,r}var Fe=o((function(t){var e=Object.prototype.hasOwnProperty,r="~";function n(){}function o(t,e,r){this.fn=t,this.context=e,this.once=r||!1}function a(t,e,n,a,i){if("function"!=typeof n)throw new TypeError("The listener must be a function");var u=new o(n,a||t,i),c=r?r+e:e;return t._events[c]?t._events[c].fn?t._events[c]=[t._events[c],u]:t._events[c].push(u):(t._events[c]=u,t._eventsCount++),t}function i(t,e){0==--t._eventsCount?t._events=new n:delete t._events[e]}function u(){this._events=new n,this._eventsCount=0}Object.create&&(n.prototype=Object.create(null),(new n).__proto__||(r=!1)),u.prototype.eventNames=function(){var t,n,o=[];if(0===this._eventsCount)return o;for(n in t=this._events)e.call(t,n)&&o.push(r?n.slice(1):n);return Object.getOwnPropertySymbols?o.concat(Object.getOwnPropertySymbols(t)):o},u.prototype.listeners=function(t){var e=r?r+t:t,n=this._events[e];if(!n)return[];if(n.fn)return[n.fn];for(var o=0,a=n.length,i=new Array(a);o<a;o++)i[o]=n[o].fn;return i},u.prototype.listenerCount=function(t){var e=r?r+t:t,n=this._events[e];return n?n.fn?1:n.length:0},u.prototype.emit=function(t,e,n,o,a,i){var u=r?r+t:t;if(!this._events[u])return!1;var c,f,s=this._events[u],l=arguments.length;if(s.fn){switch(s.once&&this.removeListener(t,s.fn,void 0,!0),l){case 1:return s.fn.call(s.context),!0;case 2:return s.fn.call(s.context,e),!0;case 3:return s.fn.call(s.context,e,n),!0;case 4:return s.fn.call(s.context,e,n,o),!0;case 5:return s.fn.call(s.context,e,n,o,a),!0;case 6:return s.fn.call(s.context,e,n,o,a,i),!0}for(f=1,c=new Array(l-1);f<l;f++)c[f-1]=arguments[f];s.fn.apply(s.context,c)}else{var v,p=s.length;for(f=0;f<p;f++)switch(s[f].once&&this.removeListener(t,s[f].fn,void 0,!0),l){case 1:s[f].fn.call(s[f].context);break;case 2:s[f].fn.call(s[f].context,e);break;case 3:s[f].fn.call(s[f].context,e,n);break;case 4:s[f].fn.call(s[f].context,e,n,o);break;default:if(!c)for(v=1,c=new Array(l-1);v<l;v++)c[v-1]=arguments[v];s[f].fn.apply(s[f].context,c)}}return!0},u.prototype.on=function(t,e,r){return a(this,t,e,r,!1)},u.prototype.once=function(t,e,r){return a(this,t,e,r,!0)},u.prototype.removeListener=function(t,e,n,o){var a=r?r+t:t;if(!this._events[a])return this;if(!e)return i(this,a),this;var u=this._events[a];if(u.fn)u.fn!==e||o&&!u.once||n&&u.context!==n||i(this,a);else{for(var c=0,f=[],s=u.length;c<s;c++)(u[c].fn!==e||o&&!u[c].once||n&&u[c].context!==n)&&f.push(u[c]);f.length?this._events[a]=1===f.length?f[0]:f:i(this,a)}return this},u.prototype.removeAllListeners=function(t){var e;return t?(e=r?r+t:t,this._events[e]&&i(this,e)):(this._events=new n,this._eventsCount=0),this},u.prototype.off=u.prototype.removeListener,u.prototype.addListener=u.prototype.on,u.prefixed=r,u.EventEmitter=u,t.exports=u}));function Ie(){return new Fe}function ze(t){if(function(t){return"[object Object]"===Object.prototype.toString.call(t)}(t)){for(var e in t)return!0;return!1}return!1}function Ue(t){var e=Object.prototype.toString.call(t);return"[object Function]"===e||"[object AsyncFunction]"===e}function Ce(t){var e,r=Object.prototype.toString.call(t);if(e="[object Promise]"===r)return!0;if("[object Function]"!==r)return!1;try{e="function"!=typeof t.subscribe&&"function"==typeof t.then}catch(t){}return e}var Ge=function(){this.__data__=new ut,this.size=0};var Me=function(t){var e=this.__data__,r=e.delete(t);return this.size=e.size,r};var Re=function(t){return this.__data__.get(t)};var $e=function(t){return this.__data__.has(t)};var Be=function(t,e){var r=this.__data__;if(r instanceof ut){var n=r.__data__;if(!ct||n.length<199)return n.push([t,e]),this.size=++r.size,this;r=this.__data__=new dt(n)}return r.set(t,e),this.size=r.size,this};function De(t){var e=this.__data__=new ut(t);this.size=e.size}De.prototype.clear=Ge,De.prototype.delete=Me,De.prototype.get=Re,De.prototype.has=$e,De.prototype.set=Be;var We=De;var Ve=function(t,e,r,n){var o=!r;r||(r={});for(var a=-1,i=e.length;++a<i;){var u=e[a],c=n?n(r[u],t[u],u,r,t):void 0;void 0===c&&(c=t[u]),o?Ft(r,u,c):zt(r,u,c)}return r};var qe=function(t,e){return t&&Ve(e,ve(e),t)};var Ye=function(t){var e=[];if(null!=t)for(var r in Object(t))e.push(r);return e},He=Object.prototype.hasOwnProperty;var Je=function(t){if(!x(t))return Ye(t);var e=ie(t),r=[];for(var n in t)("constructor"!=n||!e&&He.call(t,n))&&r.push(n);return r};var Ke=function(t){return le(t)?oe(t,!0):Je(t)};var Qe=function(t,e){return t&&Ve(e,Ke(e),t)},Xe=o((function(t,e){var r=e&&!e.nodeType&&e,n=r&&t&&!t.nodeType&&t,o=n&&n.exports===r?f.Buffer:void 0,a=o?o.allocUnsafe:void 0;t.exports=function(t,e){if(e)return t.slice();var r=t.length,n=a?a(r):new t.constructor(r);return t.copy(n),n}}));var Ze=function(t,e){var r=-1,n=t.length;for(e||(e=Array(n));++r<n;)e[r]=t[r];return e};var tr=function(t,e){for(var r=-1,n=null==t?0:t.length,o=0,a=[];++r<n;){var i=t[r];e(i,r,t)&&(a[o++]=i)}return a};var er=function(){return[]},rr=Object.prototype.propertyIsEnumerable,nr=Object.getOwnPropertySymbols,or=nr?function(t){return null==t?[]:(t=Object(t),tr(nr(t),(function(e){return rr.call(t,e)})))}:er;var ar=function(t,e){return Ve(t,or(t),e)};var ir=function(t,e){for(var r=-1,n=e.length,o=t.length;++r<n;)t[o+r]=e[r];return t},ur=ue(Object.getPrototypeOf,Object),cr=Object.getOwnPropertySymbols?function(t){for(var e=[];t;)ir(e,or(t)),t=ur(t);return e}:er;var fr=function(t,e){return Ve(t,cr(t),e)};var sr=function(t,e,r){var n=e(t);return i(t)?n:ir(n,r(t))};var lr=function(t){return sr(t,ve,or)};var vr=function(t){return sr(t,Ke,cr)},pr=$(f,"DataView"),hr=$(f,"Promise"),yr=$(f,"Set"),br=$(f,"WeakMap"),dr="[object Map]",gr="[object Promise]",jr="[object Set]",_r="[object WeakMap]",mr="[object DataView]",wr=N(pr),Tr=N(ct),Or=N(hr),xr=N(yr),Ar=N(br),Sr=j;(pr&&Sr(new pr(new ArrayBuffer(1)))!=mr||ct&&Sr(new ct)!=dr||hr&&Sr(hr.resolve())!=gr||yr&&Sr(new yr)!=jr||br&&Sr(new br)!=_r)&&(Sr=function(t){var e=j(t),r="[object Object]"==e?t.constructor:void 0,n=r?N(r):"";if(n)switch(n){case wr:return mr;case Tr:return dr;case Or:return gr;case xr:return jr;case Ar:return _r}return e});var Pr=Sr,Er=Object.prototype.hasOwnProperty;var Lr=function(t){var e=t.length,r=new t.constructor(e);return e&&"string"==typeof t[0]&&Er.call(t,"index")&&(r.index=t.index,r.input=t.input),r},kr=f.Uint8Array;var Nr=function(t){var e=new t.constructor(t.byteLength);return new kr(e).set(new kr(t)),e};var Fr=function(t,e){var r=e?Nr(t.buffer):t.buffer;return new t.constructor(r,t.byteOffset,t.byteLength)},Ir=/\w*$/;var zr=function(t){var e=new t.constructor(t.source,Ir.exec(t));return e.lastIndex=t.lastIndex,e},Ur=s?s.prototype:void 0,Cr=Ur?Ur.valueOf:void 0;var Gr=function(t){return Cr?Object(Cr.call(t)):{}};var Mr=function(t,e){var r=e?Nr(t.buffer):t.buffer;return new t.constructor(r,t.byteOffset,t.length)};var Rr=function(t,e,r){var n=t.constructor;switch(e){case"[object ArrayBuffer]":return Nr(t);case"[object Boolean]":case"[object Date]":return new n(+t);case"[object DataView]":return Fr(t,r);case"[object Float32Array]":case"[object Float64Array]":case"[object Int8Array]":case"[object Int16Array]":case"[object Int32Array]":case"[object Uint8Array]":case"[object Uint8ClampedArray]":case"[object Uint16Array]":case"[object Uint32Array]":return Mr(t,r);case"[object Map]":return new n;case"[object Number]":case"[object String]":return new n(t);case"[object RegExp]":return zr(t);case"[object Set]":return new n;case"[object Symbol]":return Gr(t)}},$r=Object.create,Br=function(){function t(){}return function(e){if(!x(e))return{};if($r)return $r(e);t.prototype=e;var r=new t;return t.prototype=void 0,r}}();var Dr=function(t){return"function"!=typeof t.constructor||ie(t)?{}:Br(ur(t))};var Wr=function(t){return _(t)&&"[object Map]"==Pr(t)},Vr=te&&te.isMap,qr=Vr?Zt(Vr):Wr;var Yr=function(t){return _(t)&&"[object Set]"==Pr(t)},Hr=te&&te.isSet,Jr=Hr?Zt(Hr):Yr,Kr="[object Arguments]",Qr="[object Function]",Xr="[object Object]",Zr={};Zr[Kr]=Zr["[object Array]"]=Zr["[object ArrayBuffer]"]=Zr["[object DataView]"]=Zr["[object Boolean]"]=Zr["[object Date]"]=Zr["[object Float32Array]"]=Zr["[object Float64Array]"]=Zr["[object Int8Array]"]=Zr["[object Int16Array]"]=Zr["[object Int32Array]"]=Zr["[object Map]"]=Zr["[object Number]"]=Zr[Xr]=Zr["[object RegExp]"]=Zr["[object Set]"]=Zr["[object String]"]=Zr["[object Symbol]"]=Zr["[object Uint8Array]"]=Zr["[object Uint8ClampedArray]"]=Zr["[object Uint16Array]"]=Zr["[object Uint32Array]"]=!0,Zr["[object Error]"]=Zr[Qr]=Zr["[object WeakMap]"]=!1;var tn=function t(e,r,n,o,a,u){var c,f=1&r,s=2&r,l=4&r;if(n&&(c=a?n(e,o,a,u):n(e)),void 0!==c)return c;if(!x(e))return e;var v=i(e);if(v){if(c=Lr(e),!f)return Ze(e,c)}else{var p=Pr(e),h=p==Qr||"[object GeneratorFunction]"==p;if(Jt(e))return Xe(e,f);if(p==Xr||p==Kr||h&&!a){if(c=s||h?{}:Dr(e),!f)return s?fr(e,Qe(c,e)):ar(e,qe(c,e))}else{if(!Zr[p])return a?e:{};c=Rr(e,p,f)}}u||(u=new We);var y=u.get(e);if(y)return y;u.set(e,c),Jr(e)?e.forEach((function(o){c.add(t(o,r,n,o,e,u))})):qr(e)&&e.forEach((function(o,a){c.set(a,t(o,r,n,a,e,u))}));var b=v?void 0:(l?s?vr:lr:s?Ke:ve)(e);return Rt(b||e,(function(o,a){b&&(o=e[a=o]),zt(c,a,t(o,r,n,a,e,u))})),c};var en=function(t){return tn(t,5)},rn=f.isFinite,nn=Math.min;var on=function(t){var e=Math[t];return function(t,r){if(t=Se(t),(r=null==r?0:nn(Le(r),292))&&rn(t)){var n=(St(t)+"e").split("e"),o=e(n[0]+"e"+(+n[1]+r));return+((n=(St(o)+"e").split("e"))[0]+"e"+(+n[1]-r))}return e(t)}}("round");function an(t){return!(!function(t){return"[object String]"===Object.prototype.toString.call(t)}(t)||""===t)}function un(t){var e=!1;return an(t)?e=!isNaN(Number(t)):function(t){return"[object Number]"===Object.prototype.toString.call(t)}(t)&&(e=!0),e}function cn(t){if(!un(t))return 0;t=function(t){return un(t)?Ee(t):0}(t);var e=on(t);return"0"===String(e)?0:e}var fn=function(t){return St(t).toLowerCase()};var sn=function(t,e,r){var n=t.length;return r=void 0===r?n:r,!e&&r>=n?t:ge(t,e,r)};var ln=function(t,e,r,n){for(var o=t.length,a=r+(n?1:-1);n?a--:++a<o;)if(e(t[a],a,t))return a;return-1};var vn=function(t){return t!=t};var pn=function(t,e,r){for(var n=r-1,o=t.length;++n<o;)if(t[n]===e)return n;return-1};var hn=function(t,e,r){return e==e?pn(t,e,r):ln(t,vn,r)};var yn=function(t,e){for(var r=t.length;r--&&hn(e,t[r],0)>-1;);return r};var bn=function(t,e){for(var r=-1,n=t.length;++r<n&&hn(e,t[r],0)>-1;);return r};var dn=function(t){return t.split("")},gn=RegExp("[\\u200d\\ud800-\\udfff\\u0300-\\u036f\\ufe20-\\ufe2f\\u20d0-\\u20ff\\ufe0e\\ufe0f]");var jn=function(t){return gn.test(t)},_n="[\\ud800-\\udfff]",mn="[\\u0300-\\u036f\\ufe20-\\ufe2f\\u20d0-\\u20ff]",wn="\\ud83c[\\udffb-\\udfff]",Tn="[^\\ud800-\\udfff]",On="(?:\\ud83c[\\udde6-\\uddff]){2}",xn="[\\ud800-\\udbff][\\udc00-\\udfff]",An="(?:"+mn+"|"+wn+")"+"?",Sn="[\\ufe0e\\ufe0f]?",Pn=Sn+An+("(?:\\u200d(?:"+[Tn,On,xn].join("|")+")"+Sn+An+")*"),En="(?:"+[Tn+mn+"?",mn,On,xn,_n].join("|")+")",Ln=RegExp(wn+"(?="+wn+")|"+En+Pn,"g");var kn=function(t){return t.match(Ln)||[]};var Nn=function(t){return jn(t)?kn(t):dn(t)};var Fn=function(t,e,r){if((t=St(t))&&(r||void 0===e))return we(t);if(!t||!(e=At(e)))return t;var n=Nn(t),o=Nn(e),a=bn(n,o),i=yn(n,o)+1;return sn(n,a,i).join("")};var In=function(t){return!0===t||!1===t||_(t)&&"[object Boolean]"==j(t)};function zn(t){if(function(t){return In(t)}(t))return t;if(0===t)return!1;if(1===t)return!0;var e=!1;return an(t)&&"true"===(t=fn(Fn(t)))&&(e=!0),e}function Un(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:10;un(t)||(t=10);var e=Ne();return setTimeout((function(){e.resolve()}),t),e}function Cn(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},r={},n=!1;t.usePollingTableTags?t.usePollingTableTags=zn(t.usePollingTableTags):t.usePollingTableTags=!1,t.pollingIntervalTime?t.pollingIntervalTime=cn(t.pollingIntervalTime):t.pollingIntervalTime=2e3;var o=new Ie;function i(t){for(var e=arguments.length,r=new Array(e>1?e-1:0),n=1;n<e;n++)r[n-1]=arguments[n];setTimeout((function(){o.emit.apply(o,[t].concat(r))}),1)}function u(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{};r=t}function c(){return f.apply(this,arguments)}function f(){return(f=e(a.mark((function t(){var e,n,o,u=arguments;return a.wrap((function(t){for(;;)switch(t.prev=t.next){case 0:return e=u.length>0&&void 0!==u[0]?u[0]:{},n=[],i("beforeUpdateTableTags",{oldTableTags:en(r),newTableTags:en(e)}),o=!1,be(e,(function(t,e){r[e]!==t&&(o=!0)})),i("refreshState",{needToRefresh:o,oldTableTags:en(r),newTableTags:en(e)}),be(e,(function(t,e){if(r[e]!==t){var o=Ne(),a={tableName:e,timeTag:t,pm:o};n.push(o),i("refreshTable",a),o.then((function(n){r[e]=t,i("getData",{tableName:e,timeTag:t,data:n})})).catch((function(t){i("error",{msg:"can not get table data: "+e,err:t})}))}})),t.next=9,Promise.all(n);case 9:i("afterUpdateTableTags",{oldTableTags:en(r),newTableTags:en(e)});case 10:case"end":return t.stop()}}),t)})))).apply(this,arguments)}function s(){return l.apply(this,arguments)}function l(){return(l=e(a.mark((function e(){var r,o;return a.wrap((function(e){for(;;)switch(e.prev=e.next){case 0:if(!n){e.next=2;break}return e.abrupt("return");case 2:return n=!0,i("beforePollingTableTags"),i("refreshTags",{pm:r=Ne()}),e.next=8,r.catch((function(t){i("error",{msg:"can not get tags data",err:t})}));case 8:if(!(o=e.sent)){e.next=12;break}return e.next=12,c(o);case 12:return e.next=14,Un(t.pollingIntervalTime);case 14:i("afterPollingTableTags"),n=!1;case 16:case"end":return e.stop()}}),e)})))).apply(this,arguments)}return t.usePollingTableTags&&"undefined"!=typeof window&&window.addEventListener("mouseover",(function(t){s()}),!1),o.setTableTags=u,o.updateTableTags=c,o.pollingTableTags=s,o}return function(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},r={},n=Ie(),o=kt(t,"instWConverClient",null);if(null===o)return n.emit("error","invalid opt.instWConverClient"),n;var i=kt(t,"cbGetToken",null);Ue(i)||(i=function(){return""});var u=kt(t,"cbGetServerMethods",null);if(!Ue(u))return n.emit("error","invalid opt.cbGetServerMethods"),n;var c=kt(t,"cbRecvData",null);if(!Ue(c))return n.emit("error","invalid opt.cbRecvData"),n;var f=kt(t,"cbGetRefreshState",null),s=kt(t,"cbGetRefreshTable",null),l=kt(t,"cbBeforeUpdateTableTags",null),v=kt(t,"cbAfterUpdateTableTags",null),p=kt(t,"cbBeforePollingTableTags",null),h=kt(t,"cbAfterPollingTableTags",null),y=Cn();function b(t){function r(){return(r=e(a.mark((function e(){var r,n,u,c,f,s,l=arguments;return a.wrap((function(e){for(;;)switch(e.prev=e.next){case 0:if(r=Ne(),n=Array.prototype.slice.call(l),u=function(){},Ue(c=de(n))&&(u=c,n=ke(n)),!Ce(f=i())){e.next=10;break}return e.next=9,f;case 9:f=e.sent;case 10:return void 0===f&&(f=""),s={__sysInputArgs__:n,__sysToken__:f},e.next=14,o.execute(t,s,(function(t,e,r){u({prog:t,p:e,m:r})})).then((function(t){var e=t.msg;"success"===t.state?r.resolve(e):r.reject(e)})).catch((function(t){r.reject(t)}));case 14:return e.abrupt("return",r);case 15:case"end":return e.stop()}}),e)})))).apply(this,arguments)}return function(){return r.apply(this,arguments)}}function d(t){r={},be(t,(function(t){Mt(r,t,b(t))})),u(r)}function g(t){"syncTable"===kt(t,"mode")&&y.updateTableTags(kt(t,"data"))}return o.on("openOnce",(function(){b("getFuncList")().then((function(t){d(t)})).catch((function(t){n.emit("error",t)}))})),o.on("broadcast",(function(t){g(t)})),o.on("deliver",(function(t){g(t)})),y.on("refreshState",(function(t){Ue(f)&&f(t)})),y.on("refreshTable",(function(t){ze(r[t.tableName])?(Ue(s)&&s(t),r[t.tableName].select().then((function(e){t.pm.resolve(e)})).catch((function(e){console.log("".concat(t.tableName,".select: catch"),e)}))):n.emit("error","無法存取".concat(t.tableName,"資料表"))})),y.on("getData",(function(t){c(t)})),y.on("beforeUpdateTableTags",(function(t){Ue(l)&&l(t)})),y.on("afterUpdateTableTags",(function(t){Ue(v)&&v(t)})),y.on("beforePollingTableTags",(function(){Ue(p)&&p()})),y.on("afterPollingTableTags",(function(){Ue(h)&&h()})),y.on("error",(function(t){n.emit("error",t)})),n}}));
//# sourceMappingURL=w-serv-webdata-client.umd.js.map
