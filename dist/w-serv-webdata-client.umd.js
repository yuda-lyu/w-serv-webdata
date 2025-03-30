/*!
 * w-serv-webdata-client v1.0.35
 * (c) 2018-2021 yuda-lyu(semisphere)
 * Released under the MIT License.
 */
!function(t,e){"object"==typeof exports&&"undefined"!=typeof module?module.exports=e():"function"==typeof define&&define.amd?define(e):(t="undefined"!=typeof globalThis?globalThis:t||self)["w-serv-webdata-client"]=e()}(this,(function(){"use strict";var t=Array.isArray,e="object"==typeof global&&global&&global.Object===Object&&global,n="object"==typeof self&&self&&self.Object===Object&&self,r=e||n||Function("return this")(),o=r.Symbol,i=Object.prototype,a=i.hasOwnProperty,c=i.toString,u=o?o.toStringTag:void 0;var f=Object.prototype.toString;var s="[object Null]",l="[object Undefined]",p=o?o.toStringTag:void 0;function v(t){return null==t?void 0===t?l:s:p&&p in Object(t)?function(t){var e=a.call(t,u),n=t[u];try{t[u]=void 0;var r=!0}catch(t){}var o=c.call(t);return r&&(e?t[u]=n:delete t[u]),o}(t):function(t){return f.call(t)}(t)}function b(t){return null!=t&&"object"==typeof t}var h="[object Symbol]";function y(t){return"symbol"==typeof t||b(t)&&v(t)==h}var d=/\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/,j=/^\w*$/;function g(t){var e=typeof t;return null!=t&&("object"==e||"function"==e)}var _="[object AsyncFunction]",m="[object Function]",w="[object GeneratorFunction]",O="[object Proxy]";function T(t){if(!g(t))return!1;var e=v(t);return e==m||e==w||e==_||e==O}var A,x=r["__core-js_shared__"],S=(A=/[^.]+$/.exec(x&&x.keys&&x.keys.IE_PROTO||""))?"Symbol(src)_1."+A:"";var E=Function.prototype.toString;function C(t){if(null!=t){try{return E.call(t)}catch(t){}try{return t+""}catch(t){}}return""}var P=/^\[object .+?Constructor\]$/,U=Function.prototype,z=Object.prototype,F=U.toString,I=z.hasOwnProperty,N=RegExp("^"+F.call(I).replace(/[\\^$.*+?()[\]{}|]/g,"\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g,"$1.*?")+"$");function M(t){return!(!g(t)||(e=t,S&&S in e))&&(T(t)?N:P).test(C(t));var e}function $(t,e){var n=function(t,e){return null==t?void 0:t[e]}(t,e);return M(n)?n:void 0}var k=$(Object,"create");var D=Object.prototype.hasOwnProperty;var W=Object.prototype.hasOwnProperty;function B(t){var e=-1,n=null==t?0:t.length;for(this.clear();++e<n;){var r=t[e];this.set(r[0],r[1])}}function L(t,e){return t===e||t!=t&&e!=e}function R(t,e){for(var n=t.length;n--;)if(L(t[n][0],e))return n;return-1}B.prototype.clear=function(){this.__data__=k?k(null):{},this.size=0},B.prototype.delete=function(t){var e=this.has(t)&&delete this.__data__[t];return this.size-=e?1:0,e},B.prototype.get=function(t){var e=this.__data__;if(k){var n=e[t];return"__lodash_hash_undefined__"===n?void 0:n}return D.call(e,t)?e[t]:void 0},B.prototype.has=function(t){var e=this.__data__;return k?void 0!==e[t]:W.call(e,t)},B.prototype.set=function(t,e){var n=this.__data__;return this.size+=this.has(t)?0:1,n[t]=k&&void 0===e?"__lodash_hash_undefined__":e,this};var G=Array.prototype.splice;function V(t){var e=-1,n=null==t?0:t.length;for(this.clear();++e<n;){var r=t[e];this.set(r[0],r[1])}}V.prototype.clear=function(){this.__data__=[],this.size=0},V.prototype.delete=function(t){var e=this.__data__,n=R(e,t);return!(n<0)&&(n==e.length-1?e.pop():G.call(e,n,1),--this.size,!0)},V.prototype.get=function(t){var e=this.__data__,n=R(e,t);return n<0?void 0:e[n][1]},V.prototype.has=function(t){return R(this.__data__,t)>-1},V.prototype.set=function(t,e){var n=this.__data__,r=R(n,t);return r<0?(++this.size,n.push([t,e])):n[r][1]=e,this};var q=$(r,"Map");function K(t,e){var n,r,o=t.__data__;return("string"==(r=typeof(n=e))||"number"==r||"symbol"==r||"boolean"==r?"__proto__"!==n:null===n)?o["string"==typeof e?"string":"hash"]:o.map}function H(t){var e=-1,n=null==t?0:t.length;for(this.clear();++e<n;){var r=t[e];this.set(r[0],r[1])}}H.prototype.clear=function(){this.size=0,this.__data__={hash:new B,map:new(q||V),string:new B}},H.prototype.delete=function(t){var e=K(this,t).delete(t);return this.size-=e?1:0,e},H.prototype.get=function(t){return K(this,t).get(t)},H.prototype.has=function(t){return K(this,t).has(t)},H.prototype.set=function(t,e){var n=K(this,t),r=n.size;return n.set(t,e),this.size+=n.size==r?0:1,this};var J="Expected a function";function Q(t,e){if("function"!=typeof t||null!=e&&"function"!=typeof e)throw new TypeError(J);var n=function(){var r=arguments,o=e?e.apply(this,r):r[0],i=n.cache;if(i.has(o))return i.get(o);var a=t.apply(this,r);return n.cache=i.set(o,a)||i,a};return n.cache=new(Q.Cache||H),n}Q.Cache=H;var X,Y,Z,tt=/[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g,et=/\\(\\)?/g,nt=(X=function(t){var e=[];return 46===t.charCodeAt(0)&&e.push(""),t.replace(tt,(function(t,n,r,o){e.push(r?o.replace(et,"$1"):n||t)})),e},Y=Q(X,(function(t){return 500===Z.size&&Z.clear(),t})),Z=Y.cache,Y),rt=nt;var ot=1/0,it=o?o.prototype:void 0,at=it?it.toString:void 0;function ct(e){if("string"==typeof e)return e;if(t(e))return function(t,e){for(var n=-1,r=null==t?0:t.length,o=Array(r);++n<r;)o[n]=e(t[n],n,t);return o}(e,ct)+"";if(y(e))return at?at.call(e):"";var n=e+"";return"0"==n&&1/e==-ot?"-0":n}function ut(t){return null==t?"":ct(t)}function ft(e,n){return t(e)?e:function(e,n){if(t(e))return!1;var r=typeof e;return!("number"!=r&&"symbol"!=r&&"boolean"!=r&&null!=e&&!y(e))||j.test(e)||!d.test(e)||null!=n&&e in Object(n)}(e,n)?[e]:rt(ut(e))}var st=1/0;function lt(t){if("string"==typeof t||y(t))return t;var e=t+"";return"0"==e&&1/t==-st?"-0":e}function pt(t,e,n){var r=null==t?void 0:function(t,e){for(var n=0,r=(e=ft(e,t)).length;null!=t&&n<r;)t=t[lt(e[n++])];return n&&n==r?t:void 0}(t,e);return void 0===r?n:r}var vt=function(){try{var t=$(Object,"defineProperty");return t({},"",{}),t}catch(t){}}(),bt=vt;function ht(t,e,n){"__proto__"==e&&bt?bt(t,e,{configurable:!0,enumerable:!0,value:n,writable:!0}):t[e]=n}var yt=Object.prototype.hasOwnProperty;function dt(t,e,n){var r=t[e];yt.call(t,e)&&L(r,n)&&(void 0!==n||e in t)||ht(t,e,n)}var jt=9007199254740991,gt=/^(?:0|[1-9]\d*)$/;function _t(t,e){var n=typeof t;return!!(e=null==e?jt:e)&&("number"==n||"symbol"!=n&&gt.test(t))&&t>-1&&t%1==0&&t<e}function mt(t,e,n){return null==t?t:function(t,e,n,r){if(!g(t))return t;for(var o=-1,i=(e=ft(e,t)).length,a=i-1,c=t;null!=c&&++o<i;){var u=lt(e[o]),f=n;if("__proto__"===u||"constructor"===u||"prototype"===u)return t;if(o!=a){var s=c[u];void 0===(f=r?r(s,u,c):void 0)&&(f=g(s)?s:_t(e[o+1])?[]:{})}dt(c,u,f),c=c[u]}return t}(t,e,n)}function wt(t,e){for(var n=-1,r=null==t?0:t.length;++n<r&&!1!==e(t[n],n,t););return t}var Ot,Tt=function(t,e,n){for(var r=-1,o=Object(t),i=n(t),a=i.length;a--;){var c=i[Ot?a:++r];if(!1===e(o[c],c,o))break}return t};function At(t){return b(t)&&"[object Arguments]"==v(t)}var xt=Object.prototype,St=xt.hasOwnProperty,Et=xt.propertyIsEnumerable,Ct=At(function(){return arguments}())?At:function(t){return b(t)&&St.call(t,"callee")&&!Et.call(t,"callee")},Pt=Ct;var Ut="object"==typeof exports&&exports&&!exports.nodeType&&exports,zt=Ut&&"object"==typeof module&&module&&!module.nodeType&&module,Ft=zt&&zt.exports===Ut?r.Buffer:void 0,It=(Ft?Ft.isBuffer:void 0)||function(){return!1},Nt=9007199254740991;function Mt(t){return"number"==typeof t&&t>-1&&t%1==0&&t<=Nt}var $t={};function kt(t){return function(e){return t(e)}}$t["[object Float32Array]"]=$t["[object Float64Array]"]=$t["[object Int8Array]"]=$t["[object Int16Array]"]=$t["[object Int32Array]"]=$t["[object Uint8Array]"]=$t["[object Uint8ClampedArray]"]=$t["[object Uint16Array]"]=$t["[object Uint32Array]"]=!0,$t["[object Arguments]"]=$t["[object Array]"]=$t["[object ArrayBuffer]"]=$t["[object Boolean]"]=$t["[object DataView]"]=$t["[object Date]"]=$t["[object Error]"]=$t["[object Function]"]=$t["[object Map]"]=$t["[object Number]"]=$t["[object Object]"]=$t["[object RegExp]"]=$t["[object Set]"]=$t["[object String]"]=$t["[object WeakMap]"]=!1;var Dt="object"==typeof exports&&exports&&!exports.nodeType&&exports,Wt=Dt&&"object"==typeof module&&module&&!module.nodeType&&module,Bt=Wt&&Wt.exports===Dt&&e.process,Lt=function(){try{var t=Wt&&Wt.require&&Wt.require("util").types;return t||Bt&&Bt.binding&&Bt.binding("util")}catch(t){}}(),Rt=Lt&&Lt.isTypedArray,Gt=Rt?kt(Rt):function(t){return b(t)&&Mt(t.length)&&!!$t[v(t)]},Vt=Object.prototype.hasOwnProperty;function qt(e,n){var r=t(e),o=!r&&Pt(e),i=!r&&!o&&It(e),a=!r&&!o&&!i&&Gt(e),c=r||o||i||a,u=c?function(t,e){for(var n=-1,r=Array(t);++n<t;)r[n]=e(n);return r}(e.length,String):[],f=u.length;for(var s in e)!n&&!Vt.call(e,s)||c&&("length"==s||i&&("offset"==s||"parent"==s)||a&&("buffer"==s||"byteLength"==s||"byteOffset"==s)||_t(s,f))||u.push(s);return u}var Kt=Object.prototype;function Ht(t){var e=t&&t.constructor;return t===("function"==typeof e&&e.prototype||Kt)}function Jt(t,e){return function(n){return t(e(n))}}var Qt=Jt(Object.keys,Object),Xt=Object.prototype.hasOwnProperty;function Yt(t){return null!=t&&Mt(t.length)&&!T(t)}function Zt(t){return Yt(t)?qt(t):function(t){if(!Ht(t))return Qt(t);var e=[];for(var n in Object(t))Xt.call(t,n)&&"constructor"!=n&&e.push(n);return e}(t)}var te=function(t,e){return function(n,r){if(null==n)return n;if(!Yt(n))return t(n,r);for(var o=n.length,i=e?o:-1,a=Object(n);(e?i--:++i<o)&&!1!==r(a[i],i,a););return n}}((function(t,e){return t&&Tt(t,e,Zt)})),ee=te;function ne(t){return t}function re(e,n){var r;return(t(e)?wt:ee)(e,"function"==typeof(r=n)?r:ne)}var oe=/\s/;var ie=/^\s+/;function ae(t){return t?t.slice(0,function(t){for(var e=t.length;e--&&oe.test(t.charAt(e)););return e}(t)+1).replace(ie,""):t}var ce=NaN,ue=/^[-+]0x[0-9a-f]+$/i,fe=/^0b[01]+$/i,se=/^0o[0-7]+$/i,le=parseInt;function pe(t){if("number"==typeof t)return t;if(y(t))return ce;if(g(t)){var e="function"==typeof t.valueOf?t.valueOf():t;t=g(e)?e+"":e}if("string"!=typeof t)return 0===t?t:+t;t=ae(t);var n=fe.test(t);return n||se.test(t)?le(t.slice(2),n?2:8):ue.test(t)?ce:+t}var ve=1/0,be=17976931348623157e292;function he(t){return t?(t=pe(t))===ve||t===-ve?(t<0?-1:1)*be:t==t?t:0:0===t?t:0}function ye(t){var e=he(t),n=e%1;return e==e?n?e-n:e:0}function de(t,e,n){var r=null==t?0:t.length;return r?function(t,e,n){var r=-1,o=t.length;e<0&&(e=-e>o?0:o+e),(n=n>o?o:n)<0&&(n+=o),o=e>n?0:n-e>>>0,e>>>=0;for(var i=Array(o);++r<o;)i[r]=t[r+e];return i}(t,0,(e=r-(e=n||void 0===e?1:ye(e)))<0?0:e):[]}function je(){let t,e,n=new Promise((function(){t=arguments[0],e=arguments[1]}));return n.resolve=t,n.reject=e,n}var ge={};!function(t){var e=Object.prototype.hasOwnProperty,n="~";function r(){}function o(t,e,n){this.fn=t,this.context=e,this.once=n||!1}function i(t,e,r,i,a){if("function"!=typeof r)throw new TypeError("The listener must be a function");var c=new o(r,i||t,a),u=n?n+e:e;return t._events[u]?t._events[u].fn?t._events[u]=[t._events[u],c]:t._events[u].push(c):(t._events[u]=c,t._eventsCount++),t}function a(t,e){0==--t._eventsCount?t._events=new r:delete t._events[e]}function c(){this._events=new r,this._eventsCount=0}Object.create&&(r.prototype=Object.create(null),(new r).__proto__||(n=!1)),c.prototype.eventNames=function(){var t,r,o=[];if(0===this._eventsCount)return o;for(r in t=this._events)e.call(t,r)&&o.push(n?r.slice(1):r);return Object.getOwnPropertySymbols?o.concat(Object.getOwnPropertySymbols(t)):o},c.prototype.listeners=function(t){var e=n?n+t:t,r=this._events[e];if(!r)return[];if(r.fn)return[r.fn];for(var o=0,i=r.length,a=new Array(i);o<i;o++)a[o]=r[o].fn;return a},c.prototype.listenerCount=function(t){var e=n?n+t:t,r=this._events[e];return r?r.fn?1:r.length:0},c.prototype.emit=function(t,e,r,o,i,a){var c=n?n+t:t;if(!this._events[c])return!1;var u,f,s=this._events[c],l=arguments.length;if(s.fn){switch(s.once&&this.removeListener(t,s.fn,void 0,!0),l){case 1:return s.fn.call(s.context),!0;case 2:return s.fn.call(s.context,e),!0;case 3:return s.fn.call(s.context,e,r),!0;case 4:return s.fn.call(s.context,e,r,o),!0;case 5:return s.fn.call(s.context,e,r,o,i),!0;case 6:return s.fn.call(s.context,e,r,o,i,a),!0}for(f=1,u=new Array(l-1);f<l;f++)u[f-1]=arguments[f];s.fn.apply(s.context,u)}else{var p,v=s.length;for(f=0;f<v;f++)switch(s[f].once&&this.removeListener(t,s[f].fn,void 0,!0),l){case 1:s[f].fn.call(s[f].context);break;case 2:s[f].fn.call(s[f].context,e);break;case 3:s[f].fn.call(s[f].context,e,r);break;case 4:s[f].fn.call(s[f].context,e,r,o);break;default:if(!u)for(p=1,u=new Array(l-1);p<l;p++)u[p-1]=arguments[p];s[f].fn.apply(s[f].context,u)}}return!0},c.prototype.on=function(t,e,n){return i(this,t,e,n,!1)},c.prototype.once=function(t,e,n){return i(this,t,e,n,!0)},c.prototype.removeListener=function(t,e,r,o){var i=n?n+t:t;if(!this._events[i])return this;if(!e)return a(this,i),this;var c=this._events[i];if(c.fn)c.fn!==e||o&&!c.once||r&&c.context!==r||a(this,i);else{for(var u=0,f=[],s=c.length;u<s;u++)(c[u].fn!==e||o&&!c[u].once||r&&c[u].context!==r)&&f.push(c[u]);f.length?this._events[i]=1===f.length?f[0]:f:a(this,i)}return this},c.prototype.removeAllListeners=function(t){var e;return t?(e=n?n+t:t,this._events[e]&&a(this,e)):(this._events=new r,this._eventsCount=0),this},c.prototype.off=c.prototype.removeListener,c.prototype.addListener=c.prototype.on,c.prefixed=n,c.EventEmitter=c,t.exports=c}({get exports(){return ge},set exports(t){ge=t}});var _e=ge;function me(){return new _e}function we(t){return"[object Object]"===Object.prototype.toString.call(t)}function Oe(t){return"[object String]"===Object.prototype.toString.call(t)}function Te(t){return!(!Oe(t)||""===t)}function Ae(t){return t!=t}function xe(t){let e=!1;if(Te(t))e=!isNaN(Number(t));else if(function(t){return"[object Number]"===Object.prototype.toString.call(t)}(t)){if(Ae(t))return!1;e=!0}return e}function Se(t,e){return!!we(t)&&(!(!Te(e)&&!xe(e))&&e in t)}function Ee(t){if(we(t)){for(let e in t)return!0;return!1}return!1}function Ce(t){let e=Object.prototype.toString.call(t);return"[object Function]"===e||"[object AsyncFunction]"===e}function Pe(t){var e=this.__data__=new V(t);this.size=e.size}function Ue(t,e,n,r){var o=!n;n||(n={});for(var i=-1,a=e.length;++i<a;){var c=e[i],u=r?r(n[c],t[c],c,n,t):void 0;void 0===u&&(u=t[c]),o?ht(n,c,u):dt(n,c,u)}return n}Pe.prototype.clear=function(){this.__data__=new V,this.size=0},Pe.prototype.delete=function(t){var e=this.__data__,n=e.delete(t);return this.size=e.size,n},Pe.prototype.get=function(t){return this.__data__.get(t)},Pe.prototype.has=function(t){return this.__data__.has(t)},Pe.prototype.set=function(t,e){var n=this.__data__;if(n instanceof V){var r=n.__data__;if(!q||r.length<199)return r.push([t,e]),this.size=++n.size,this;n=this.__data__=new H(r)}return n.set(t,e),this.size=n.size,this};var ze=Object.prototype.hasOwnProperty;function Fe(t){if(!g(t))return function(t){var e=[];if(null!=t)for(var n in Object(t))e.push(n);return e}(t);var e=Ht(t),n=[];for(var r in t)("constructor"!=r||!e&&ze.call(t,r))&&n.push(r);return n}function Ie(t){return Yt(t)?qt(t,!0):Fe(t)}var Ne="object"==typeof exports&&exports&&!exports.nodeType&&exports,Me=Ne&&"object"==typeof module&&module&&!module.nodeType&&module,$e=Me&&Me.exports===Ne?r.Buffer:void 0,ke=$e?$e.allocUnsafe:void 0;function De(){return[]}var We=Object.prototype.propertyIsEnumerable,Be=Object.getOwnPropertySymbols,Le=Be?function(t){return null==t?[]:(t=Object(t),function(t,e){for(var n=-1,r=null==t?0:t.length,o=0,i=[];++n<r;){var a=t[n];e(a,n,t)&&(i[o++]=a)}return i}(Be(t),(function(e){return We.call(t,e)})))}:De,Re=Le;function Ge(t,e){for(var n=-1,r=e.length,o=t.length;++n<r;)t[o+n]=e[n];return t}var Ve=Jt(Object.getPrototypeOf,Object),qe=Object.getOwnPropertySymbols?function(t){for(var e=[];t;)Ge(e,Re(t)),t=Ve(t);return e}:De,Ke=qe;function He(e,n,r){var o=n(e);return t(e)?o:Ge(o,r(e))}function Je(t){return He(t,Zt,Re)}function Qe(t){return He(t,Ie,Ke)}var Xe=$(r,"DataView"),Ye=$(r,"Promise"),Ze=$(r,"Set"),tn=$(r,"WeakMap"),en="[object Map]",nn="[object Promise]",rn="[object Set]",on="[object WeakMap]",an="[object DataView]",cn=C(Xe),un=C(q),fn=C(Ye),sn=C(Ze),ln=C(tn),pn=v;(Xe&&pn(new Xe(new ArrayBuffer(1)))!=an||q&&pn(new q)!=en||Ye&&pn(Ye.resolve())!=nn||Ze&&pn(new Ze)!=rn||tn&&pn(new tn)!=on)&&(pn=function(t){var e=v(t),n="[object Object]"==e?t.constructor:void 0,r=n?C(n):"";if(r)switch(r){case cn:return an;case un:return en;case fn:return nn;case sn:return rn;case ln:return on}return e});var vn=pn,bn=Object.prototype.hasOwnProperty;var hn=r.Uint8Array;function yn(t){var e=new t.constructor(t.byteLength);return new hn(e).set(new hn(t)),e}var dn=/\w*$/;var jn=o?o.prototype:void 0,gn=jn?jn.valueOf:void 0;var _n="[object Boolean]",mn="[object Date]",wn="[object Map]",On="[object Number]",Tn="[object RegExp]",An="[object Set]",xn="[object String]",Sn="[object Symbol]",En="[object ArrayBuffer]",Cn="[object DataView]",Pn="[object Float32Array]",Un="[object Float64Array]",zn="[object Int8Array]",Fn="[object Int16Array]",In="[object Int32Array]",Nn="[object Uint8Array]",Mn="[object Uint8ClampedArray]",$n="[object Uint16Array]",kn="[object Uint32Array]";function Dn(t,e,n){var r,o=t.constructor;switch(e){case En:return yn(t);case _n:case mn:return new o(+t);case Cn:return function(t,e){var n=e?yn(t.buffer):t.buffer;return new t.constructor(n,t.byteOffset,t.byteLength)}(t,n);case Pn:case Un:case zn:case Fn:case In:case Nn:case Mn:case $n:case kn:return function(t,e){var n=e?yn(t.buffer):t.buffer;return new t.constructor(n,t.byteOffset,t.length)}(t,n);case wn:return new o;case On:case xn:return new o(t);case Tn:return function(t){var e=new t.constructor(t.source,dn.exec(t));return e.lastIndex=t.lastIndex,e}(t);case An:return new o;case Sn:return r=t,gn?Object(gn.call(r)):{}}}var Wn=Object.create,Bn=function(){function t(){}return function(e){if(!g(e))return{};if(Wn)return Wn(e);t.prototype=e;var n=new t;return t.prototype=void 0,n}}(),Ln=Bn;var Rn=Lt&&Lt.isMap,Gn=Rn?kt(Rn):function(t){return b(t)&&"[object Map]"==vn(t)};var Vn=Lt&&Lt.isSet,qn=Vn?kt(Vn):function(t){return b(t)&&"[object Set]"==vn(t)},Kn=1,Hn=2,Jn=4,Qn="[object Arguments]",Xn="[object Function]",Yn="[object GeneratorFunction]",Zn="[object Object]",tr={};function er(e,n,r,o,i,a){var c,u=n&Kn,f=n&Hn,s=n&Jn;if(r&&(c=i?r(e,o,i,a):r(e)),void 0!==c)return c;if(!g(e))return e;var l=t(e);if(l){if(c=function(t){var e=t.length,n=new t.constructor(e);return e&&"string"==typeof t[0]&&bn.call(t,"index")&&(n.index=t.index,n.input=t.input),n}(e),!u)return function(t,e){var n=-1,r=t.length;for(e||(e=Array(r));++n<r;)e[n]=t[n];return e}(e,c)}else{var p=vn(e),v=p==Xn||p==Yn;if(It(e))return function(t,e){if(e)return t.slice();var n=t.length,r=ke?ke(n):new t.constructor(n);return t.copy(r),r}(e,u);if(p==Zn||p==Qn||v&&!i){if(c=f||v?{}:function(t){return"function"!=typeof t.constructor||Ht(t)?{}:Ln(Ve(t))}(e),!u)return f?function(t,e){return Ue(t,Ke(t),e)}(e,function(t,e){return t&&Ue(e,Ie(e),t)}(c,e)):function(t,e){return Ue(t,Re(t),e)}(e,function(t,e){return t&&Ue(e,Zt(e),t)}(c,e))}else{if(!tr[p])return i?e:{};c=Dn(e,p,u)}}a||(a=new Pe);var b=a.get(e);if(b)return b;a.set(e,c),qn(e)?e.forEach((function(t){c.add(er(t,n,r,t,e,a))})):Gn(e)&&e.forEach((function(t,o){c.set(o,er(t,n,r,o,e,a))}));var h=l?void 0:(s?f?Qe:Je:f?Ie:Zt)(e);return wt(h||e,(function(t,o){h&&(t=e[o=t]),dt(c,o,er(t,n,r,o,e,a))})),c}tr[Qn]=tr["[object Array]"]=tr["[object ArrayBuffer]"]=tr["[object DataView]"]=tr["[object Boolean]"]=tr["[object Date]"]=tr["[object Float32Array]"]=tr["[object Float64Array]"]=tr["[object Int8Array]"]=tr["[object Int16Array]"]=tr["[object Int32Array]"]=tr["[object Map]"]=tr["[object Number]"]=tr[Zn]=tr["[object RegExp]"]=tr["[object Set]"]=tr["[object String]"]=tr["[object Symbol]"]=tr["[object Uint8Array]"]=tr["[object Uint8ClampedArray]"]=tr["[object Uint16Array]"]=tr["[object Uint32Array]"]=!0,tr["[object Error]"]=tr[Xn]=tr["[object WeakMap]"]=!1;var nr=1,rr=4;function or(t){return er(t,nr|rr)}var ir="[object Boolean]";function ar(t){return!0===(e=t)||!1===e||b(e)&&v(e)==ir;var e}function cr(t){if(!xe(t))return 0;return he(t)}function ur(t){return!!xe(t)&&(t=cr(t),"number"==typeof(e=t)&&e==ye(e));var e}var fr=r.isFinite,sr=Math.min;var lr=function(t){var e=Math[t];return function(t,n){if(t=pe(t),(n=null==n?0:sr(ye(n),292))&&fr(t)){var r=(ut(t)+"e").split("e");return+((r=(ut(e(r[0]+"e"+(+r[1]+n)))+"e").split("e"))[0]+"e"+(+r[1]-n))}return e(t)}}("round"),pr=lr;function vr(t){if(!xe(t))return 0;t=cr(t);let e=pr(t);return"0"===String(e)?0:e}function br(t){if(!ur(t))return!1;return vr(t)>0}function hr(t){let e=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{},n={},r=!1;if(Ee(t)||(console.log("instWConverClient is not an effective object, and set instWConverClient to an EventEmitter"),t=me()),!Se(t,"emit"))throw new Error("instWConverClient is not an EventEmitter");let o=pt(e,"autoPollingTableTagsForActive");ar(o)||(o=!1);let i=pt(e,"pollingDelayTime");br(i)||(i=2e3),i=vr(i);let a=function(e){for(var n=arguments.length,r=new Array(n>1?n-1:0),o=1;o<n;o++)r[o-1]=arguments[o];setTimeout((()=>{t.emit(e,...r)}),1)};async function c(){let t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},e=[];a("beforeUpdateTableTags",{oldTableTags:or(n),newTableTags:or(t)});let r=!1;re(t,((t,e)=>{n[e]!==t&&(r=!0)})),a("refreshState",{needToRefresh:r,oldTableTags:or(n),newTableTags:or(t)}),re(t,((t,r)=>{if(n[r]!==t){let o=je(),i={tableName:r,timeTag:t,pm:o};e.push(o),a("refreshTable",i),o.then((e=>{n[r]=t,a("getData",{tableName:r,timeTag:t,data:e})})).catch((t=>{a("error",{msg:"can not get table data: "+r,err:t})}))}})),await Promise.all(e),a("afterUpdateTableTags",{oldTableTags:or(n),newTableTags:or(t)})}async function u(){if(r)return;r=!0,a("beforePollingTableTags");let t=je();a("refreshTags",{pm:t});let e=await t.catch((t=>{a("error",{msg:"can not get tags data",err:t})}));e&&await c(e),await function(){let t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:10;xe(t)||(t=10);let e=je();return setTimeout((function(){e.resolve()}),t),e}(i),a("afterPollingTableTags"),r=!1}return o&&"undefined"!=typeof window&&(window.addEventListener("mouseover",(t=>{u()}),!1),window.addEventListener("touchmove",(t=>{u()}),!1)),t.setTableTags=function(){n=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{}},t.updateTableTags=c,t.pollingTableTags=u,t}function yr(t){return"[object Array]"===Object.prototype.toString.call(t)}function dr(t){return!!function(t){return"[object Undefined]"===Object.prototype.toString.call(t)}(t)||(!!function(t){return"[object Null]"===Object.prototype.toString.call(t)}(t)||(!!function(t){if(we(t)){for(let e in t)return!1;return!0}return!1}(t)||(!!function(t){return!(!Oe(t)||""!==t)}(t)||(!!function(t){return!!yr(t)&&0===t.length}(t)||!!Ae(t)))))}let jr="0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".split(""),gr=jr.length;function _r(t){let e=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{};if(Ee(t)||(console.log("instWConverClient is not an effective object, and set instWConverClient to an EventEmitter"),t=me()),!Se(t,"emit"))throw new Error("instWConverClient is not an EventEmitter");let n=pt(e,"timePolling");var r;ur(r=n)&&vr(r)>=0||(n=2e3),n=vr(n);let o=pt(t,"clientId");Te(o)||(o=function(){let t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:32,e=[];t=br(t)?vr(t):32;for(let n=0;n<t;n++)e[n]=jr[0|Math.random()*gr];return e.join("")}());let i=function(e){for(var n=arguments.length,r=new Array(n>1?n-1:0),o=1;o<n;o++)r[o-1]=arguments[o];setTimeout((()=>{t.emit(e,...r)}),1)},a=!1,c=!1;return setInterval((()=>{t.execute("[sys:polling]",{clientId:o},(function(t,e,n){})).then((function(t){!1===a&&(a=!0,i("openOnce")),!1===c&&i("open"),c=!0,function(t){return!(!yr(t)||0===t.length||1===t.length&&dr(t[0]))}(t)&&re(t,(t=>{let e=pt(t,"data",null);i("broadcast",e)}))})).catch((function(t){c=!1,i("error",t)}))}),n),t}return function(t){let e=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{},n={};if(Ee(t)||(console.log("instWConverClient is not an effective object, and set instWConverClient to an EventEmitter"),t=me()),!Se(t,"emit"))throw new Error("instWConverClient is not an EventEmitter");let r=pt(e,"funGetToken",null);Ce(r)||(r=()=>"");let o=pt(e,"funGetServerMethods",null);if(!Ce(o))return t.emit("error","invalid opt.funGetServerMethods"),t;let i=pt(e,"funRecvData",null);if(!Ce(i))return t.emit("error","invalid opt.funRecvData"),t;let a=pt(e,"funGetRefreshState",null),c=pt(e,"funGetRefreshTable",null),u=pt(e,"funBeforeUpdateTableTags",null),f=pt(e,"funAfterUpdateTableTags",null);function s(e){return async function(){let n=je(),o=[...arguments],i=()=>{},a=(u=null==(c=o)?0:c.length)?c[u-1]:void 0;var c,u;Ce(a)&&(i=a,o=de(o));let f=r();(function(t){let e,n=Object.prototype.toString.call(t);if(e="[object Promise]"===n,e)return!0;if("[object Function]"!==n)return!1;try{e="function"!=typeof t.subscribe&&"function"==typeof t.then}catch(t){}return e})(f)&&(f=await f),Te(f)||(f="");let s={__sysInputArgs__:o,__sysToken__:f};return await t.execute(e,s,(function(t,e,n){i({prog:t,p:e,m:n})})).then((t=>{let e=t.msg;"success"===t.state?n.resolve(e):n.reject(e)})).catch((t=>{n.reject(t)})),n}}function l(e){"syncKpTable"===pt(e,"mode")&&t.updateTableTags(pt(e,"data"))}return(t=new _r(t=new hr(t))).on("openOnce",(function(){s("[sys:getFuncList]")().then((t=>{n={},re(t,(t=>{mt(n,t,s(t))})),o(n)})).catch((e=>{t.emit("error",e)})),s("[sys:getTableTags]")().then((t=>{l(t)})).catch((e=>{t.emit("error",e)}))})),t.on("broadcast",(function(t){l(t)})),t.on("refreshState",(t=>{Ce(a)&&a(t)})),t.on("refreshTable",(e=>{Ee(n[e.tableName])?(Ce(c)&&c(e),n[e.tableName].select().then((t=>{e.pm.resolve(t)})).catch((t=>{console.log(`${e.tableName}.select: catch`,t),e.pm.resolve([])}))):t.emit("error",`invalid execs[${e.tableName}]`)})),t.on("getData",(t=>{i(t)})),t.on("beforeUpdateTableTags",(t=>{Ce(u)&&u(t)})),t.on("afterUpdateTableTags",(t=>{Ce(f)&&f(t)})),t}}));
//# sourceMappingURL=w-serv-webdata-client.umd.js.map
