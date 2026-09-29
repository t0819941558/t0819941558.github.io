---
title: "JS-Foreach"
publishedAt: 2020-06-19
legacyPath: "/2020/06/19/JS-Foreach/"
archived: true
---
# [](#JS-Foreach "JS-Foreach")JS-Foreach

## [](#普通的for循环 "普通的for循环")普通的for循环

```javascript
var arr = [1, 2, 3]for(var i = 0; i < arr.length; i++) { // 这里的i是代表数组的下标    console.log(i); // 0, 1, 2};
```

## [](#优化版的for循环 "优化版的for循环")优化版的for循环

```javascript
var arr = [1, 2, 3]for(var i = 0, len = arr.length; i < len; i++) { // 这里的i是代表数组的下标console.log(i); // 0, 1, 2 };
```

## [](#for···of···遍历（支持es6） "for···of···遍历（支持es6）")for···of···遍历（支持es6）

```javascript
var arr = [1, 2, 3]for(var item of arr) { // item代表数组里面的元素    console.log(item); // 1, 2, 3};
```

## [](#forEach "forEach()")forEach()

```javascript
var arr = [1, 2, 3];arr.forEach((item, index, arr) => { // item为arr的元素，index为下标，arr原数组    console.log(item); // 1, 2, 3    console.log(index); // 0, 1, 2    console.log(arr); // [1, 2, 3]});
```

**缺点：不支持终止循环**

## [](#some "some()")some()

```javascript
var arr = [1, 2, 3];arr.some((item, index, arr) => { // item为数组中的元素，index为下标，arr为目标数组    console.log(item); // 1, 2, 3    console.log(index); // 0, 1, 2    console.log(arr); // [1, 2, 3]  })
```

-   如果有一个元素满足条件，则表达式返回true , 剩余的元素不会再执行检测。
-   如果没有满足条件的元素，则返回false。

## [](#every "every()")every()

```javascript
var arr = [1, 2, 3];arr.every((item, index, arr) => { // item为数组中的元素，index为下标，arr为目标数组    return item > 0; // true    return index == 0; // false})
```

-   如果数组中检测到有一个元素不满足，则整个表达式返回 false ，且剩余的元素不会再进行检测。
-   如果所有元素都满足条件，则返回 true。

## [](#for···in···遍历 "for···in···遍历")for···in···遍历

```plain
var arr = [1, 2, 3]for(var item in arr) { // item遍历数组时为数组的下标，遍历对象时为对象的key值    console.log(item); // 0, 1, 2};
```

**for…in更多是用来遍历对象，很少用来遍历数组， 不过 item 对应与数组的 key值，建议不要用该方法来遍历数组，因为它的效率是最低的。**

## [](#filter（） "filter（）")filter（）

```plain
var arr = [1, 2, 3];arr.filter(item => { // item为数组当前的元素    return item > 1; // [2, 3]})
```

## [](#map "map()")map()

```javascript
var arr = [1, 2, 3];arr.map(item => { // item为数组的元素    console.log(item); // 1, 2, 3    return item * 2; // 返回一个处理过的新数组[2, 4, 6]})
```

## [](#map和filter的区别 "map和filter的区别")map和filter的区别

```javascript
let arr=[2,4,1,5,3,1];let res1=arr.map(function (item,index,array) {  // return array[index]; //用这种方法也可以获取到当前处理的元素  return item>1;});let res2=arr.filter(function (item,index,array) {  return item>1;});console.log(res1,res2);//[ true, true, false, true, true, false ] [ 2, 4, 5, 3 ]
```

**区别：
可以看到，map的结果只是对当前元素调用函数后（x是否大于1）的结果。而filter 会将结果为true的数组存到新的数组里面.**

## [](#javaScript：关于-1-2-3-map-parseInt-问题的解析 "javaScript：关于 [1,2,3]map(parseInt)问题的解析")javaScript：关于 \[1,2,3\]map(parseInt)问题的解析

1.  map()方法的定义用法和参数：

-   map()方法定义：
    按照原始数组元素顺序依次处理元素，然后返回一个新数组

-   map()语法：
    array.map(function(item,index,array),this)

-   参数说明：
    1.item： 必须，当前处理的数组的值
    2.index：可选，当前处理的值得索引
    3.array：可选，当前处理的值所属于的数组对象
    4.this：可选。对象作为该执行回调时使用，传递给函数，用作 “this” 的值。如果省略了 thisValue ，”this” 的值为 “undefined”。

```javascript
var numbers=[1,2,3,4,5,6];numbers.map(function(item,index){   console.log(item+”-”+index);})
```

2.  parseInt()函数的定义用法和参数:

-   parseInt()方法定义：
    解析一个字符串，并返回一个整数。当参数 radix 的值为 0，或没有设置该参数时，parseInt() 会根据 string 来判断数字的基数。

    -   如果 string 以 “0x” 开头，parseInt() 会把 string 的其余部分解析为十六进制的整数。
    -   如果 string 以 0 开头，那么 ECMAScript v3 允许 parseInt() 的一个实现把其后的字符解析为八进制或十六进制的数字。
    -   如果 string 以 1 ~ 9 的数字开头，parseInt() 将把它解析为十进制的整数。
-   parseInt(string,radix)
    string: 必须，要被解析的字符串
    radix：可选。表示要解析的数字基数，介于2-36之间。

```javascript
console.log(parseInt(1,0));//将十进制数1转化为十进制数，仍为1console.log(parseInt(2,1));//将一进制数2（不存在）转化为十进制数，NaNconsole.log(parseInt(3,2));//NaNconsole.log(parseInt(4,3));//NaNconsole.log(parseInt(10,4));//将四进制数10转化为十进制数为4
```

## [](#附（-NET-MVC-ActionResult详解） "附（.NET MVC ActionResult详解）")附（.NET MVC ActionResult详解）

> ActionResult是控制器方法执行后返回的结果类型，控制器方法可以返回一个直接或间接从ActionResult抽象类继承的类型，如果返回的是非ActionResult类型，控制器将会将结果转换为一个ContentResult类型。默认的ControllerActionInvoker调用ActionResult.ExecuteResult方法生成应答结果。

### [](#各种Result说明 "各种Result说明")各种Result说明

| 动作类型 | 行为 |
| --- | --- |
| ContentResult | 返回简单的纯文本内容，可通过ContentType属性指定应答文档类型，通过ContentEncoding属性指定应答文档的字符编码。可通过Controller类中的Content方法便捷地返回ContentResult对象。如果控制器方法返回非ActionResult对象，MVC将简单地以返回对象的ToString()内容为基础产生一个ContentResult对象。 |
| FileContentResult | 返回文件内容。FilePath通过路径传送文件到客户端，FileContent通过二进制数据的方式，而FileStream是通过Stream的方式来传送。Controller为这三个文件结果类型提供了一个名为File的重载方法。 |
| FilePathResult | 返回路径文件的内容 |
| EmptyResult | 返回一个空的结果。如果控制器方法返回一个null，MVC将其转换成EmptyResult对象。 |
| JavaScriptResult | 返回一段JavaScript代码.本质上是一个文本内容，只是将Response.ContentType设置为 application/x-javascript，此结果应该和MicrosoftMvcAjax.js脚本配合使用，客户端接收到Ajax应答后，将判断Response.ContentType的值，如果是application/x-javascript,则直接eval执行返回的应答内容。此结果类型对应的Controller方法为JavaScript。 |
| **JsonResult** | **返回Json格式数据。 MVC将Response.ContentType设置为application/json，并通过JavaScriptSerializer类将指定对象序列化为Json表示方式。需要注意，默认情况下，MVC不允许GET请求返回JSON结果，要解除此限制，在生成JsonResult对象时，将其JsonRequestBehavior属性设置为JsonRequestBehavior.AllowGet。此结果对应的Controller方法为Json。** |
| RedirectToResult | 表示一个连接跳转，相当于ASP.NET中的Response.Redirect方法。对应的Controller方法为Redirect。 |
| HttpUnauthorizedResult | 返回HTTP403未授权状态码 |
| RedirectToRouteResult | 重定向到不同的控制器动作 |
| **ViewResult** | **接收视图引擎的响应** |
| **PartialViewResult** | **接收分部视图引擎的响应** |

### [](#Result的封装 "Result的封装")Result的封装

| 类型 | 实例化对象 | 封装方法 |
| --- | --- | --- |
| Json结果 | JsonResult | Json（Object） |
| 跳转 | RedirectResult | Redirect（url） |
| 文件 | FileResult | File（） |
| 视图 | ViewResult | View（） |
| 文本 | ContentResult | Content（“”）; |
