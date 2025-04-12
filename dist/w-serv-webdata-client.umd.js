/*!
 * w-serv-webdata-client v1.0.55
 * (c) 2018-2021 yuda-lyu(semisphere)
 * Released under the MIT License.
 */
!function(t,e){"object"==typeof exports&&"undefined"!=typeof module?module.exports=e():"function"==typeof define&&define.amd?define(e):(t="undefined"!=typeof globalThis?globalThis:t||self)["w-serv-webdata-client"]=e()}(this,(function(){"use strict";var t=Array.isArray,e="object"==typeof global&&global&&global.Object===Object&&global,n="object"==typeof self&&self&&self.Object===Object&&self,r=e||n||Function("return this")(),o=r.Symbol,i=Object.prototype,a=i.hasOwnProperty,c=i.toString,u=o?o.toStringTag:void 0;var s=Object.prototype.toString;var l="[object Null]",f="[object Undefined]",p=o?o.toStringTag:void 0;function v(t){return null==t?void 0===t?f:l:p&&p in Object(t)?function(t){var e=a.call(t,u),n=t[u];try{t[u]=void 0;var r=!0}catch(t){}var o=c.call(t);return r&&(e?t[u]=n:delete t[u]),o}(t):function(t){return s.call(t)}(t)}function b(t){return null!=t&&"object"==typeof t}var h="[object Symbol]";function y(t){return"symbol"==typeof t||b(t)&&v(t)==h}var d=/\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/,j=/^\w*$/;function g(t){var e=typeof t;return null!=t&&("object"==e||"function"==e)}var _="[object AsyncFunction]",m="[object Function]",w="[object GeneratorFunction]",O="[object Proxy]";function T(t){if(!g(t))return!1;var e=v(t);return e==m||e==w||e==_||e==O}var A,x=r["__core-js_shared__"],S=(A=/[^.]+$/.exec(x&&x.keys&&x.keys.IE_PROTO||""))?"Symbol(src)_1."+A:"";var E=Function.prototype.toString;function C(t){if(null!=t){try{return E.call(t)}catch(t){}try{return t+""}catch(t){}}return""}var P=/^\[object .+?Constructor\]$/,U=Function.prototype,z=Object.prototype,F=U.toString,I=z.hasOwnProperty,N=RegExp("^"+F.call(I).replace(/[\\^$.*+?()[\]{}|]/g,"\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g,"$1.*?")+"$");function k(t){return!(!g(t)||(e=t,S&&S in e))&&(T(t)?N:P).test(C(t));var e}function $(t,e){var n=function(t,e){return null==t?void 0:t[e]}(t,e);return k(n)?n:void 0}var M=$(Object,"create");var B=Object.prototype.hasOwnProperty;var D=Object.prototype.hasOwnProperty;function W(t){var e=-1,n=null==t?0:t.length;for(this.clear();++e<n;){var r=t[e];this.set(r[0],r[1])}}function L(t,e){return t===e||t!=t&&e!=e}function R(t,e){for(var n=t.length;n--;)if(L(t[n][0],e))return n;return-1}W.prototype.clear=function(){this.__data__=M?M(null):{},this.size=0},W.prototype.delete=function(t){var e=this.has(t)&&delete this.__data__[t];return this.size-=e?1:0,e},W.prototype.get=function(t){var e=this.__data__;if(M){var n=e[t];return"__lodash_hash_undefined__"===n?void 0:n}return B.call(e,t)?e[t]:void 0},W.prototype.has=function(t){var e=this.__data__;return M?void 0!==e[t]:D.call(e,t)},W.prototype.set=function(t,e){var n=this.__data__;return this.size+=this.has(t)?0:1,n[t]=M&&void 0===e?"__lodash_hash_undefined__":e,this};var V=Array.prototype.splice;function q(t){var e=-1,n=null==t?0:t.length;for(this.clear();++e<n;){var r=t[e];this.set(r[0],r[1])}}q.prototype.clear=function(){this.__data__=[],this.size=0},q.prototype.delete=function(t){var e=this.__data__,n=R(e,t);return!(n<0)&&(n==e.length-1?e.pop():V.call(e,n,1),--this.size,!0)},q.prototype.get=function(t){var e=this.__data__,n=R(e,t);return n<0?void 0:e[n][1]},q.prototype.has=function(t){return R(this.__data__,t)>-1},q.prototype.set=function(t,e){var n=this.__data__,r=R(n,t);return r<0?(++this.size,n.push([t,e])):n[r][1]=e,this};var G=$(r,"Map");function K(t,e){var n,r,o=t.__data__;return("string"==(r=typeof(n=e))||"number"==r||"symbol"==r||"boolean"==r?"__proto__"!==n:null===n)?o["string"==typeof e?"string":"hash"]:o.map}function H(t){var e=-1,n=null==t?0:t.length;for(this.clear();++e<n;){var r=t[e];this.set(r[0],r[1])}}H.prototype.clear=function(){this.size=0,this.__data__={hash:new W,map:new(G||q),string:new W}},H.prototype.delete=function(t){var e=K(this,t).delete(t);return this.size-=e?1:0,e},H.prototype.get=function(t){return K(this,t).get(t)},H.prototype.has=function(t){return K(this,t).has(t)},H.prototype.set=function(t,e){var n=K(this,t),r=n.size;return n.set(t,e),this.size+=n.size==r?0:1,this};var J="Expected a function";function Q(t,e){if("function"!=typeof t||null!=e&&"function"!=typeof e)throw new TypeError(J);var n=function(){var r=arguments,o=e?e.apply(this,r):r[0],i=n.cache;if(i.has(o))return i.get(o);var a=t.apply(this,r);return n.cache=i.set(o,a)||i,a};return n.cache=new(Q.Cache||H),n}Q.Cache=H;var X,Y,Z,tt=/[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g,et=/\\(\\)?/g,nt=(X=function(t){var e=[];return 46===t.charCodeAt(0)&&e.push(""),t.replace(tt,(function(t,n,r,o){e.push(r?o.replace(et,"$1"):n||t)})),e},Y=Q(X,(function(t){return 500===Z.size&&Z.clear(),t})),Z=Y.cache,Y),rt=nt;var ot=1/0,it=o?o.prototype:void 0,at=it?it.toString:void 0;function ct(e){if("string"==typeof e)return e;if(t(e))return function(t,e){for(var n=-1,r=null==t?0:t.length,o=Array(r);++n<r;)o[n]=e(t[n],n,t);return o}(e,ct)+"";if(y(e))return at?at.call(e):"";var n=e+"";return"0"==n&&1/e==-ot?"-0":n}function ut(t){return null==t?"":ct(t)}function st(e,n){return t(e)?e:function(e,n){if(t(e))return!1;var r=typeof e;return!("number"!=r&&"symbol"!=r&&"boolean"!=r&&null!=e&&!y(e))||j.test(e)||!d.test(e)||null!=n&&e in Object(n)}(e,n)?[e]:rt(ut(e))}var lt=1/0;function ft(t){if("string"==typeof t||y(t))return t;var e=t+"";return"0"==e&&1/t==-lt?"-0":e}function pt(t,e,n){var r=null==t?void 0:function(t,e){for(var n=0,r=(e=st(e,t)).length;null!=t&&n<r;)t=t[ft(e[n++])];return n&&n==r?t:void 0}(t,e);return void 0===r?n:r}var vt=function(){try{var t=$(Object,"defineProperty");return t({},"",{}),t}catch(t){}}(),bt=vt;function ht(t,e,n){"__proto__"==e&&bt?bt(t,e,{configurable:!0,enumerable:!0,value:n,writable:!0}):t[e]=n}var yt=Object.prototype.hasOwnProperty;function dt(t,e,n){var r=t[e];yt.call(t,e)&&L(r,n)&&(void 0!==n||e in t)||ht(t,e,n)}var jt=9007199254740991,gt=/^(?:0|[1-9]\d*)$/;function _t(t,e){var n=typeof t;return!!(e=null==e?jt:e)&&("number"==n||"symbol"!=n&&gt.test(t))&&t>-1&&t%1==0&&t<e}function mt(t,e,n){return null==t?t:function(t,e,n,r){if(!g(t))return t;for(var o=-1,i=(e=st(e,t)).length,a=i-1,c=t;null!=c&&++o<i;){var u=ft(e[o]),s=n;if("__proto__"===u||"constructor"===u||"prototype"===u)return t;if(o!=a){var l=c[u];void 0===(s=r?r(l,u,c):void 0)&&(s=g(l)?l:_t(e[o+1])?[]:{})}dt(c,u,s),c=c[u]}return t}(t,e,n)}function wt(t,e){for(var n=-1,r=null==t?0:t.length;++n<r&&!1!==e(t[n],n,t););return t}var Ot,Tt=function(t,e,n){for(var r=-1,o=Object(t),i=n(t),a=i.length;a--;){var c=i[Ot?a:++r];if(!1===e(o[c],c,o))break}return t};function At(t){return b(t)&&"[object Arguments]"==v(t)}var xt=Object.prototype,St=xt.hasOwnProperty,Et=xt.propertyIsEnumerable,Ct=At(function(){return arguments}())?At:function(t){return b(t)&&St.call(t,"callee")&&!Et.call(t,"callee")},Pt=Ct;var Ut="object"==typeof exports&&exports&&!exports.nodeType&&exports,zt=Ut&&"object"==typeof module&&module&&!module.nodeType&&module,Ft=zt&&zt.exports===Ut?r.Buffer:void 0,It=(Ft?Ft.isBuffer:void 0)||function(){return!1},Nt=9007199254740991;function kt(t){return"number"==typeof t&&t>-1&&t%1==0&&t<=Nt}var $t={};function Mt(t){return function(e){return t(e)}}$t["[object Float32Array]"]=$t["[object Float64Array]"]=$t["[object Int8Array]"]=$t["[object Int16Array]"]=$t["[object Int32Array]"]=$t["[object Uint8Array]"]=$t["[object Uint8ClampedArray]"]=$t["[object Uint16Array]"]=$t["[object Uint32Array]"]=!0,$t["[object Arguments]"]=$t["[object Array]"]=$t["[object ArrayBuffer]"]=$t["[object Boolean]"]=$t["[object DataView]"]=$t["[object Date]"]=$t["[object Error]"]=$t["[object Function]"]=$t["[object Map]"]=$t["[object Number]"]=$t["[object Object]"]=$t["[object RegExp]"]=$t["[object Set]"]=$t["[object String]"]=$t["[object WeakMap]"]=!1;var Bt="object"==typeof exports&&exports&&!exports.nodeType&&exports,Dt=Bt&&"object"==typeof module&&module&&!module.nodeType&&module,Wt=Dt&&Dt.exports===Bt&&e.process,Lt=function(){try{var t=Dt&&Dt.require&&Dt.require("util").types;return t||Wt&&Wt.binding&&Wt.binding("util")}catch(t){}}(),Rt=Lt&&Lt.isTypedArray,Vt=Rt?Mt(Rt):function(t){return b(t)&&kt(t.length)&&!!$t[v(t)]},qt=Object.prototype.hasOwnProperty;function Gt(e,n){var r=t(e),o=!r&&Pt(e),i=!r&&!o&&It(e),a=!r&&!o&&!i&&Vt(e),c=r||o||i||a,u=c?function(t,e){for(var n=-1,r=Array(t);++n<t;)r[n]=e(n);return r}(e.length,String):[],s=u.length;for(var l in e)!n&&!qt.call(e,l)||c&&("length"==l||i&&("offset"==l||"parent"==l)||a&&("buffer"==l||"byteLength"==l||"byteOffset"==l)||_t(l,s))||u.push(l);return u}var Kt=Object.prototype;function Ht(t){var e=t&&t.constructor;return t===("function"==typeof e&&e.prototype||Kt)}function Jt(t,e){return function(n){return t(e(n))}}var Qt=Jt(Object.keys,Object),Xt=Object.prototype.hasOwnProperty;function Yt(t){return null!=t&&kt(t.length)&&!T(t)}function Zt(t){return Yt(t)?Gt(t):function(t){if(!Ht(t))return Qt(t);var e=[];for(var n in Object(t))Xt.call(t,n)&&"constructor"!=n&&e.push(n);return e}(t)}var te=function(t,e){return function(n,r){if(null==n)return n;if(!Yt(n))return t(n,r);for(var o=n.length,i=e?o:-1,a=Object(n);(e?i--:++i<o)&&!1!==r(a[i],i,a););return n}}((function(t,e){return t&&Tt(t,e,Zt)})),ee=te;function ne(t){return t}function re(e,n){var r;return(t(e)?wt:ee)(e,"function"==typeof(r=n)?r:ne)}var oe=/\s/;var ie=/^\s+/;function ae(t){return t?t.slice(0,function(t){for(var e=t.length;e--&&oe.test(t.charAt(e)););return e}(t)+1).replace(ie,""):t}var ce=NaN,ue=/^[-+]0x[0-9a-f]+$/i,se=/^0b[01]+$/i,le=/^0o[0-7]+$/i,fe=parseInt;function pe(t){if("number"==typeof t)return t;if(y(t))return ce;if(g(t)){var e="function"==typeof t.valueOf?t.valueOf():t;t=g(e)?e+"":e}if("string"!=typeof t)return 0===t?t:+t;t=ae(t);var n=se.test(t);return n||le.test(t)?fe(t.slice(2),n?2:8):ue.test(t)?ce:+t}var ve=1/0,be=17976931348623157e292;function he(t){return t?(t=pe(t))===ve||t===-ve?(t<0?-1:1)*be:t==t?t:0:0===t?t:0}function ye(t){var e=he(t),n=e%1;return e==e?n?e-n:e:0}function de(t,e,n){var r=null==t?0:t.length;return r?function(t,e,n){var r=-1,o=t.length;e<0&&(e=-e>o?0:o+e),(n=n>o?o:n)<0&&(n+=o),o=e>n?0:n-e>>>0,e>>>=0;for(var i=Array(o);++r<o;)i[r]=t[r+e];return i}(t,0,(e=r-(e=n||void 0===e?1:ye(e)))<0?0:e):[]}function je(){let t,e,n=new Promise((function(){t=arguments[0],e=arguments[1]}));return n.resolve=t,n.reject=e,n}var ge={};!function(t){var e=Object.prototype.hasOwnProperty,n="~";function r(){}function o(t,e,n){this.fn=t,this.context=e,this.once=n||!1}function i(t,e,r,i,a){if("function"!=typeof r)throw new TypeError("The listener must be a function");var c=new o(r,i||t,a),u=n?n+e:e;return t._events[u]?t._events[u].fn?t._events[u]=[t._events[u],c]:t._events[u].push(c):(t._events[u]=c,t._eventsCount++),t}function a(t,e){0==--t._eventsCount?t._events=new r:delete t._events[e]}function c(){this._events=new r,this._eventsCount=0}Object.create&&(r.prototype=Object.create(null),(new r).__proto__||(n=!1)),c.prototype.eventNames=function(){var t,r,o=[];if(0===this._eventsCount)return o;for(r in t=this._events)e.call(t,r)&&o.push(n?r.slice(1):r);return Object.getOwnPropertySymbols?o.concat(Object.getOwnPropertySymbols(t)):o},c.prototype.listeners=function(t){var e=n?n+t:t,r=this._events[e];if(!r)return[];if(r.fn)return[r.fn];for(var o=0,i=r.length,a=new Array(i);o<i;o++)a[o]=r[o].fn;return a},c.prototype.listenerCount=function(t){var e=n?n+t:t,r=this._events[e];return r?r.fn?1:r.length:0},c.prototype.emit=function(t,e,r,o,i,a){var c=n?n+t:t;if(!this._events[c])return!1;var u,s,l=this._events[c],f=arguments.length;if(l.fn){switch(l.once&&this.removeListener(t,l.fn,void 0,!0),f){case 1:return l.fn.call(l.context),!0;case 2:return l.fn.call(l.context,e),!0;case 3:return l.fn.call(l.context,e,r),!0;case 4:return l.fn.call(l.context,e,r,o),!0;case 5:return l.fn.call(l.context,e,r,o,i),!0;case 6:return l.fn.call(l.context,e,r,o,i,a),!0}for(s=1,u=new Array(f-1);s<f;s++)u[s-1]=arguments[s];l.fn.apply(l.context,u)}else{var p,v=l.length;for(s=0;s<v;s++)switch(l[s].once&&this.removeListener(t,l[s].fn,void 0,!0),f){case 1:l[s].fn.call(l[s].context);break;case 2:l[s].fn.call(l[s].context,e);break;case 3:l[s].fn.call(l[s].context,e,r);break;case 4:l[s].fn.call(l[s].context,e,r,o);break;default:if(!u)for(p=1,u=new Array(f-1);p<f;p++)u[p-1]=arguments[p];l[s].fn.apply(l[s].context,u)}}return!0},c.prototype.on=function(t,e,n){return i(this,t,e,n,!1)},c.prototype.once=function(t,e,n){return i(this,t,e,n,!0)},c.prototype.removeListener=function(t,e,r,o){var i=n?n+t:t;if(!this._events[i])return this;if(!e)return a(this,i),this;var c=this._events[i];if(c.fn)c.fn!==e||o&&!c.once||r&&c.context!==r||a(this,i);else{for(var u=0,s=[],l=c.length;u<l;u++)(c[u].fn!==e||o&&!c[u].once||r&&c[u].context!==r)&&s.push(c[u]);s.length?this._events[i]=1===s.length?s[0]:s:a(this,i)}return this},c.prototype.removeAllListeners=function(t){var e;return t?(e=n?n+t:t,this._events[e]&&a(this,e)):(this._events=new r,this._eventsCount=0),this},c.prototype.off=c.prototype.removeListener,c.prototype.addListener=c.prototype.on,c.prefixed=n,c.EventEmitter=c,t.exports=c}({get exports(){return ge},set exports(t){ge=t}});var _e=ge;function me(){return new _e}function we(t){return"[object Object]"===Object.prototype.toString.call(t)}function Oe(t){return"[object String]"===Object.prototype.toString.call(t)}function Te(t){return!(!Oe(t)||""===t)}function Ae(t){return t!=t}function xe(t){let e=!1;if(Te(t))e=!isNaN(Number(t));else if(function(t){return"[object Number]"===Object.prototype.toString.call(t)}(t)){if(Ae(t))return!1;e=!0}return e}function Se(t,e){return!!we(t)&&(!(!Te(e)&&!xe(e))&&e in t)}function Ee(t){if(we(t)){for(let e in t)return!0;return!1}return!1}function Ce(t){let e=Object.prototype.toString.call(t);return"[object Function]"===e||"[object AsyncFunction]"===e}function Pe(t){var e=this.__data__=new q(t);this.size=e.size}function Ue(t,e,n,r){var o=!n;n||(n={});for(var i=-1,a=e.length;++i<a;){var c=e[i],u=r?r(n[c],t[c],c,n,t):void 0;void 0===u&&(u=t[c]),o?ht(n,c,u):dt(n,c,u)}return n}Pe.prototype.clear=function(){this.__data__=new q,this.size=0},Pe.prototype.delete=function(t){var e=this.__data__,n=e.delete(t);return this.size=e.size,n},Pe.prototype.get=function(t){return this.__data__.get(t)},Pe.prototype.has=function(t){return this.__data__.has(t)},Pe.prototype.set=function(t,e){var n=this.__data__;if(n instanceof q){var r=n.__data__;if(!G||r.length<199)return r.push([t,e]),this.size=++n.size,this;n=this.__data__=new H(r)}return n.set(t,e),this.size=n.size,this};var ze=Object.prototype.hasOwnProperty;function Fe(t){if(!g(t))return function(t){var e=[];if(null!=t)for(var n in Object(t))e.push(n);return e}(t);var e=Ht(t),n=[];for(var r in t)("constructor"!=r||!e&&ze.call(t,r))&&n.push(r);return n}function Ie(t){return Yt(t)?Gt(t,!0):Fe(t)}var Ne="object"==typeof exports&&exports&&!exports.nodeType&&exports,ke=Ne&&"object"==typeof module&&module&&!module.nodeType&&module,$e=ke&&ke.exports===Ne?r.Buffer:void 0,Me=$e?$e.allocUnsafe:void 0;function Be(){return[]}var De=Object.prototype.propertyIsEnumerable,We=Object.getOwnPropertySymbols,Le=We?function(t){return null==t?[]:(t=Object(t),function(t,e){for(var n=-1,r=null==t?0:t.length,o=0,i=[];++n<r;){var a=t[n];e(a,n,t)&&(i[o++]=a)}return i}(We(t),(function(e){return De.call(t,e)})))}:Be,Re=Le;function Ve(t,e){for(var n=-1,r=e.length,o=t.length;++n<r;)t[o+n]=e[n];return t}var qe=Jt(Object.getPrototypeOf,Object),Ge=Object.getOwnPropertySymbols?function(t){for(var e=[];t;)Ve(e,Re(t)),t=qe(t);return e}:Be,Ke=Ge;function He(e,n,r){var o=n(e);return t(e)?o:Ve(o,r(e))}function Je(t){return He(t,Zt,Re)}function Qe(t){return He(t,Ie,Ke)}var Xe=$(r,"DataView"),Ye=$(r,"Promise"),Ze=$(r,"Set"),tn=$(r,"WeakMap"),en="[object Map]",nn="[object Promise]",rn="[object Set]",on="[object WeakMap]",an="[object DataView]",cn=C(Xe),un=C(G),sn=C(Ye),ln=C(Ze),fn=C(tn),pn=v;(Xe&&pn(new Xe(new ArrayBuffer(1)))!=an||G&&pn(new G)!=en||Ye&&pn(Ye.resolve())!=nn||Ze&&pn(new Ze)!=rn||tn&&pn(new tn)!=on)&&(pn=function(t){var e=v(t),n="[object Object]"==e?t.constructor:void 0,r=n?C(n):"";if(r)switch(r){case cn:return an;case un:return en;case sn:return nn;case ln:return rn;case fn:return on}return e});var vn=pn,bn=Object.prototype.hasOwnProperty;var hn=r.Uint8Array;function yn(t){var e=new t.constructor(t.byteLength);return new hn(e).set(new hn(t)),e}var dn=/\w*$/;var jn=o?o.prototype:void 0,gn=jn?jn.valueOf:void 0;var _n="[object Boolean]",mn="[object Date]",wn="[object Map]",On="[object Number]",Tn="[object RegExp]",An="[object Set]",xn="[object String]",Sn="[object Symbol]",En="[object ArrayBuffer]",Cn="[object DataView]",Pn="[object Float32Array]",Un="[object Float64Array]",zn="[object Int8Array]",Fn="[object Int16Array]",In="[object Int32Array]",Nn="[object Uint8Array]",kn="[object Uint8ClampedArray]",$n="[object Uint16Array]",Mn="[object Uint32Array]";function Bn(t,e,n){var r,o=t.constructor;switch(e){case En:return yn(t);case _n:case mn:return new o(+t);case Cn:return function(t,e){var n=e?yn(t.buffer):t.buffer;return new t.constructor(n,t.byteOffset,t.byteLength)}(t,n);case Pn:case Un:case zn:case Fn:case In:case Nn:case kn:case $n:case Mn:return function(t,e){var n=e?yn(t.buffer):t.buffer;return new t.constructor(n,t.byteOffset,t.length)}(t,n);case wn:return new o;case On:case xn:return new o(t);case Tn:return function(t){var e=new t.constructor(t.source,dn.exec(t));return e.lastIndex=t.lastIndex,e}(t);case An:return new o;case Sn:return r=t,gn?Object(gn.call(r)):{}}}var Dn=Object.create,Wn=function(){function t(){}return function(e){if(!g(e))return{};if(Dn)return Dn(e);t.prototype=e;var n=new t;return t.prototype=void 0,n}}(),Ln=Wn;var Rn=Lt&&Lt.isMap,Vn=Rn?Mt(Rn):function(t){return b(t)&&"[object Map]"==vn(t)};var qn=Lt&&Lt.isSet,Gn=qn?Mt(qn):function(t){return b(t)&&"[object Set]"==vn(t)},Kn=1,Hn=2,Jn=4,Qn="[object Arguments]",Xn="[object Function]",Yn="[object GeneratorFunction]",Zn="[object Object]",tr={};function er(e,n,r,o,i,a){var c,u=n&Kn,s=n&Hn,l=n&Jn;if(r&&(c=i?r(e,o,i,a):r(e)),void 0!==c)return c;if(!g(e))return e;var f=t(e);if(f){if(c=function(t){var e=t.length,n=new t.constructor(e);return e&&"string"==typeof t[0]&&bn.call(t,"index")&&(n.index=t.index,n.input=t.input),n}(e),!u)return function(t,e){var n=-1,r=t.length;for(e||(e=Array(r));++n<r;)e[n]=t[n];return e}(e,c)}else{var p=vn(e),v=p==Xn||p==Yn;if(It(e))return function(t,e){if(e)return t.slice();var n=t.length,r=Me?Me(n):new t.constructor(n);return t.copy(r),r}(e,u);if(p==Zn||p==Qn||v&&!i){if(c=s||v?{}:function(t){return"function"!=typeof t.constructor||Ht(t)?{}:Ln(qe(t))}(e),!u)return s?function(t,e){return Ue(t,Ke(t),e)}(e,function(t,e){return t&&Ue(e,Ie(e),t)}(c,e)):function(t,e){return Ue(t,Re(t),e)}(e,function(t,e){return t&&Ue(e,Zt(e),t)}(c,e))}else{if(!tr[p])return i?e:{};c=Bn(e,p,u)}}a||(a=new Pe);var b=a.get(e);if(b)return b;a.set(e,c),Gn(e)?e.forEach((function(t){c.add(er(t,n,r,t,e,a))})):Vn(e)&&e.forEach((function(t,o){c.set(o,er(t,n,r,o,e,a))}));var h=f?void 0:(l?s?Qe:Je:s?Ie:Zt)(e);return wt(h||e,(function(t,o){h&&(t=e[o=t]),dt(c,o,er(t,n,r,o,e,a))})),c}tr[Qn]=tr["[object Array]"]=tr["[object ArrayBuffer]"]=tr["[object DataView]"]=tr["[object Boolean]"]=tr["[object Date]"]=tr["[object Float32Array]"]=tr["[object Float64Array]"]=tr["[object Int8Array]"]=tr["[object Int16Array]"]=tr["[object Int32Array]"]=tr["[object Map]"]=tr["[object Number]"]=tr[Zn]=tr["[object RegExp]"]=tr["[object Set]"]=tr["[object String]"]=tr["[object Symbol]"]=tr["[object Uint8Array]"]=tr["[object Uint8ClampedArray]"]=tr["[object Uint16Array]"]=tr["[object Uint32Array]"]=!0,tr["[object Error]"]=tr[Xn]=tr["[object WeakMap]"]=!1;var nr=1,rr=4;function or(t){return er(t,nr|rr)}var ir="[object Boolean]";function ar(t){return!0===(e=t)||!1===e||b(e)&&v(e)==ir;var e}function cr(t){if(!xe(t))return 0;return he(t)}function ur(t){return!!xe(t)&&(t=cr(t),"number"==typeof(e=t)&&e==ye(e));var e}var sr=r.isFinite,lr=Math.min;var fr=function(t){var e=Math[t];return function(t,n){if(t=pe(t),(n=null==n?0:lr(ye(n),292))&&sr(t)){var r=(ut(t)+"e").split("e");return+((r=(ut(e(r[0]+"e"+(+r[1]+n)))+"e").split("e"))[0]+"e"+(+r[1]-n))}return e(t)}}("round"),pr=fr;function vr(t){if(!xe(t))return 0;t=cr(t);let e=pr(t);return"0"===String(e)?0:e}function br(t){if(!ur(t))return!1;return vr(t)>0}function hr(t){let e=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{},n={},r=!1;if(Ee(t)||(console.log("instWConverClient is not an effective object, and set instWConverClient to an EventEmitter"),t=me()),!Se(t,"emit"))throw new Error("instWConverClient is not an EventEmitter");let o=pt(e,"autoPollingTableTagsForActive");ar(o)||(o=!1);let i=pt(e,"pollingDelayTime");br(i)||(i=2e3),i=vr(i);let a=function(e){for(var n=arguments.length,r=new Array(n>1?n-1:0),o=1;o<n;o++)r[o-1]=arguments[o];setTimeout((()=>{t.emit(e,...r)}),1)};async function c(){let t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},e=[];a("beforeUpdateTableTags",{oldTableTags:or(n),newTableTags:or(t)});let r=!1;re(t,((t,e)=>{n[e]!==t&&(r=!0)})),a("refreshState",{needToRefresh:r,oldTableTags:or(n),newTableTags:or(t)}),re(t,((t,r)=>{if(n[r]!==t){let o=je(),i={tableName:r,timeTag:t,pm:o};e.push(o),a("refreshTable",i),o.then((e=>{n[r]=t,a("getData",{tableName:r,timeTag:t,data:e})})).catch((t=>{a("error",{msg:"can not get table data: "+r,err:t})}))}})),await Promise.all(e),a("afterUpdateTableTags",{oldTableTags:or(n),newTableTags:or(t)})}async function u(){if(r)return;r=!0;let t=je();a("refreshTags",{pm:t});let e=await t.catch((t=>{a("error",{msg:"can not get tags data",err:t})}));e&&await c(e),await function(){let t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:10;xe(t)||(t=10);let e=je();return setTimeout((function(){e.resolve()}),t),e}(i),r=!1}return o&&"undefined"!=typeof window&&void 0!==window.document&&(window.addEventListener("mouseover",(t=>{u()}),!1),window.addEventListener("touchmove",(t=>{u()}),!1)),t.setTableTags=function(){n=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{}},t.updateTableTags=c,t.pollingTableTags=u,t}let yr="0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".split(""),dr=yr.length;function jr(t){return"[object Array]"===Object.prototype.toString.call(t)}function gr(t){return!!function(t){return"[object Undefined]"===Object.prototype.toString.call(t)}(t)||(!!function(t){return"[object Null]"===Object.prototype.toString.call(t)}(t)||(!!function(t){if(we(t)){for(let e in t)return!1;return!0}return!1}(t)||(!!function(t){return!(!Oe(t)||""!==t)}(t)||(!!function(t){return!!jr(t)&&0===t.length}(t)||!!Ae(t)))))}function _r(t){let e=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{};if(Ee(t)||(console.log("instWConverClient is not an effective object, and set instWConverClient to an EventEmitter"),t=me()),!Se(t,"emit"))throw new Error("instWConverClient is not an EventEmitter");let n=pt(e,"timePolling");var r;ur(r=n)&&vr(r)>=0||(n=2e3),n=vr(n);let o=pt(t,"clientId");Te(o)||(o=function(){let t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:32,e=[];t=br(t)?vr(t):32;for(let n=0;n<t;n++)e[n]=yr[0|Math.random()*dr];return e.join("")}());let i=function(e){for(var n=arguments.length,r=new Array(n>1?n-1:0),o=1;o<n;o++)r[o-1]=arguments[o];setTimeout((()=>{t.emit(e,...r)}),1)},a=!1,c=!1,u=setInterval((()=>{t.execute("[sys:polling]",{clientId:o},(function(t){})).then((function(t){!1===a&&(a=!0,i("openOnce")),!1===c&&i("open"),c=!0,function(t){return!(!jr(t)||0===t.length||1===t.length&&gr(t[0]))}(t)&&re(t,(t=>{let e=pt(t,"data",null);i("broadcast",e)}))})).catch((function(t){c=!1,i("error",t)}))}),n);return t.clearBroadcast=()=>{clearInterval(u)},t}return function(t){let e=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{},n={};if(Ee(t)||(console.log("instWConverClient is not an effective object, and set instWConverClient to an EventEmitter"),t=me()),!Se(t,"emit"))throw new Error("instWConverClient is not an EventEmitter");let r=pt(e,"getToken",null);Ce(r)||(r=()=>"");let o=pt(e,"getServerMethods",null);if(!Ce(o))return t.emit("error","invalid opt.getServerMethods"),t;let i=pt(e,"recvData",null);if(!Ce(i))return t.emit("error","invalid opt.recvData"),t;let a=pt(e,"getRefreshState",null),c=pt(e,"getRefreshTable",null),u=pt(e,"getBeforeUpdateTableTags",null),s=pt(e,"getAfterUpdateTableTags",null);function l(e){return async function(){let n=je(),o=[...arguments],i=()=>{},a=(u=null==(c=o)?0:c.length)?c[u-1]:void 0;var c,u;Ce(a)&&(i=a,o=de(o));let s=r();(function(t){let e,n=Object.prototype.toString.call(t);if(e="[object Promise]"===n,e)return!0;if("[object Function]"!==n)return!1;try{e="function"!=typeof t.subscribe&&"function"==typeof t.then}catch(t){}return e})(s)&&(s=await s),Te(s)||(s="");let l={__sysInputArgs__:o,__sysToken__:s};return await t.execute(e,l,i).then((t=>{let e=t.msg;"success"===t.state?n.resolve(e):n.reject(e)})).catch((t=>{n.reject(t)})),n}}function f(e){"syncKpTable"===pt(e,"mode")&&t.updateTableTags(pt(e,"data"))}return(t=new _r(t=new hr(t))).on("openOnce",(function(){(async()=>{let t=await l("[sys:getFuncList]")();n={},re(t,(t=>{mt(n,t,l(t))})),o(n),f(await l("[sys:getTableTags]")())})().catch((e=>{t.emit("error",e)}))})),t.on("broadcast",(function(t){f(t)})),t.on("refreshState",(t=>{Ce(a)&&a(t)})),t.on("refreshTable",(e=>{if(!Ee(n[e.tableName]))return void t.emit("error",`invalid kpExec[${e.tableName}]`);Ce(c)&&c(e);let r=pt(n,e.tableName);if(!Ee(r))return void console.log(`kpExec[${e.tableName}] is not an effective object`);let o=pt(r,"select");Ce(o)?o().then((t=>{e.pm.resolve(t)})).catch((t=>{console.log(`${e.tableName}.select: catch`,t),e.pm.resolve([])})):console.log(`kpExec[${e.tableName}].select is not a function`)})),t.on("getData",(t=>{i(t)})),t.on("beforeUpdateTableTags",(t=>{Ce(u)&&u(t)})),t.on("afterUpdateTableTags",(t=>{Ce(s)&&s(t)})),t}}));
//# sourceMappingURL=w-serv-webdata-client.umd.js.map
