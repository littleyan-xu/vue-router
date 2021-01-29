# vue-router核心源码解析

搜罗网上vueRouter源码文章，比比皆是！但是大部分都是截取源码，然后加一些注释，写文章的作者应该确实是理解了，但初次解读源码的读者未必就能理解，毕竟有些地方还是挺绕的，所以这篇文章抛开杂念，直抵关键核心，以使用作入口逐步剖析vueRouter源码。

查看[VueRouter官网](https://router.vuejs.org/zh/)，其包含的功能还挺多，功能列表有8条之多，但其实最核心的就是根据路由地址，来渲染不同的视图，所以本文就以这个为目标，来剖析如何实现。

### 使用
1、引入VueRouter插件，并使用该插件：

```
import VueRouter from '@/vue-router'

Vue.use(VueRouter)
```

2、生成配置选项，并通过该配置实例化VueRouter类：

```
import Home from '../views/Home.vue'
import About from '../views/About.vue'
import A from '../views/A.vue' // 这是只是示意，真正的组件名请不要这么随意
import B from '../views/B.vue'  // 这是只是示意，真正的组件名请不要这么随意

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home
  },
  {
    path: '/about',
    name: 'About',
    component: About,
    children:[
      {
        path: 'a',
        component: A
      },
      {
        path: 'b',
        component: B
      }
    ]
  }
]

const router = new VueRouter({
  mode:'hash',
  routes
})

export default router
```

3、将实例化的router注入到Vue根组件：

```
import router from './router'

new Vue({
  name: 'main',
  router,
  render: h => h(App)
}).$mount('#app')

```

4、在组件里面引入router-view组件来渲染路由对应的组件

```
<template>
  <div id="app">
    <router-view />
  </div>
</template>
```


我们来逐个分析：
- 1、由于是Vue插件，那么必定是要提供install()方法
- 2、可以实例化，所以VueRouter是个Class，并且构造函数接受一个配置选项
- 3、只注入到跟节点，但是子节点也需要获取到该实例来进行操作，例如this.$router.push()来跳转路由，所以需要将router也注入到各个子组件。
- 4、需要定义一个全局的router-view组件，并且组件渲染是响应式的

将上面的几点作为突破口，逐步深入……

### 如何实现
> install()是插件的入口，vue会通过该方法来启用插件，install接受2个参数，第一个参数是 Vue 构造器，第二个参数是一个可选的选项对象，插件里面可以添加全局方法或属性、添加全局指令、注入组件选项、添加实例方法，官网传送门：[Vue插件](https://cn.vuejs.org/v2/guide/plugins.html)

根据以上信息所得，我们首先需要实现install()方法，那么该方法里面要做些什么呢?首先想到的就是实现将VueRouter实例注入到各个子组件：


1、根据组件选项上是否有router来判断是否是根组件

如果是将_routeRoot属性指向this、将this.$options.router选项值赋给_router属性；

如果不是，则将子组件的_routeRoot属性指向父组件的_routeRoot属性

这个判断在beforeCreate生命周期钩子函数里面完成，全局注册一个混入，具体代码如下：

**vue-router/install.js**

```
function install(Vue){

  // 全局注册一个混入
  Vue.mixin({
    beforeCreate() {
      // 这个钩子函数会从父往子去依次执行
      if(this.$options.router){ // 只有根实例上才有router选项
        this._routeRoot = this
        this._router = this.$options.router // new VueRouter() VueRouter类的实例
      }else{
        // 每个子组件都添加一个_routeRoot属性指向根实例，用来获取跟实例的router
        this._routeRoot = this.$parent && this.$parent._routeRoot 
      }
    },
  })
  
}
```

由于钩子函数的执行都是从父到子再到孙，所以上面的执行会先给根组件赋值，然后每个子组件都绑定了一个_routeRoot 属性来指向根组件。

2、拿到了根组件，后面的事情就好说了，添加一个全局的实例属性，VueRouter实例（根组件的_router属性）就注入到各个子组件了：

**vue-router/install.js**

```
function install(Vue){
     // 全局注册一个混入
    Vue.mixin({
        ...
    })
    
    Object.defineProperty(Vue.prototype, '$router', {
        get(){
          return this._routeRoot._router // 返回跟实例上的VueRouter实例
        }
      })
}
```

到这里万里长征走出了第一步，接下来便是VueRouter类登场。

**vue-router/index.js**

```
import install from './install'

class VueRouter{
    constructor(options){
        this.routes = options.routes || [] // 传入的路由数组
        this.mode = options.mode || 'hash'
    }
}

VueRouter.install = install

export default VueRouter
```


前面说到在实例化VueRouter类时需要传入配置选项参数，配置里面有2个重要的参数:mode和routes。

mode代表是hash模式还是history模式，官网默认hash模式，所以本文也以hash模式来做具体实现。

routes是一个数组，里面配置的是路径所对应的组件，并且路由是可以嵌套的。

我们最终需要实现的不同的路由渲染不同的组件，也就是要根据路径地址找到对应的组件，例如"/about"对应About组件，"/about/a"对应的就是A组件，所以需要去扁平化routes数组，根据path来生成一份map记录，老司机一眼就看出来了，这不就是个递归嘛

"/about/a"对应的是A组件，但其实"/about"对应About组件也是需要渲染的，并且在配置路由的时候，子路由的path前面是没有带上父路径的，是需要自动补全的，所以在做递归的时候，每份记录都要带上父路由的记录。具体代码如下：

**vue-router/create-route-map.js**
```
// routes是用户传入的配置
export default function createRouteMap(routes){
  let pathList = []
  let pathMap = Object.create(null)

  routes.forEach(route => {
    addRouteRecord(route, pathList, pathMap)
  });

  return {
    pathList,
    pathMap
  }
}

// 对routes数组进行递归
function addRouteRecord(route, pathList, pathMap, parent){
  let path = parent ? `${parent.path}/${route.path}` : route.path // 如果存在parent，则补全path
  let record = {
    path,
    component: route.component, // 用户配置的path所对应的component
    parent,
    // 源码里面这里还添加了regex、alias、name等，这里为了简洁只保留以上3个
  }

  if(!pathMap[path]){// 如果Map里面没有
    pathList.push(path)
    pathMap[path] = record
  } 

  if(route.children){
    route.children.forEach(child => {
      addRouteRecord(child, pathList, pathMap, record) // 这里的record就会变成下一次的parent
    })
  }
}

```
一番操作下来，之前的routes配置就变成了如下形式：

```
pathMap = {
    '/': {
        path: '/',
        component: Home,
        parent: undefined
    },
    '/about':{
        path: '/about',
        component: About,
        parent: undefined
    },
    '/about/a':{
        path: '/about/a',
        component: A,
        parent: {
            path: '/about',
            component: About,
            parent: undefined
        }
    },
    '/about/b':{
        path: '/about/b',
        component: B,
        parent: {
            path: '/about',
            component: About,
            parent: undefined
        }
    },
}
```
到这里离成功又近了一步，接下来就是要实现通过路径一步到位找到所有需要渲染的组件，所以就需要有一个匹配器（Matcher）来完成这个事情：


**vue-router/create-matcher.js**

```
import createRouteMap from './create-route-map'
import { createRoute } from './util/route'

export default function createMatcher(routes){ // routes : 用户传入的路由配置
    let {pathList, pathMap} = createRouteMap(routes)
    
    function match(location){
        let record = pathMap[location] // 取出map里面存放的record
        if(record){
          return createRoute(record, {
            path: location
          })
        }
        return createRoute(null, {
          path: location
        })
  }
  
  return {
    match
  }
}

```
**vue-router/util/route.js**

```
export function createRoute(record, location){
  let res = []
  if(record){
    while(record){
      res.unshift(record) // 添加到最开头
      record = record.parent
    }
  }
  return {
    ...location,
    matched:res
  }
}
```


代码中最重要的就是createRoute方法，其实就是处理上一份代码Map里面存放的record，再来回顾一下record：

```
{
    path: '/about/a',
    component: A,
    parent: {
        path: '/about',
        component: About,
        parent: undefined
    }
}
```
前面有说到parent很重要，createRoute方法里通过while循环不停的向上查找parent，并将其插入到数组的第一个，调用match方法将得到如下数据：

```
{
    path: '/about/a',
    matched:[About, A]
}
```
到这里前期的准备工作就差不多了，接下来将match方法挂到VueRouter上：
```
import install from './install'

class VueRouter{
    constructor(options){
        this.routes = options.routes || [] // 传入的路由数组
        this.mode = options.mode || 'hash'
        
        // 新添加
        this.matcher = createMatcher(this.routes) // {match}
    }
    
    // 新添加
    match(location){
       return this.matcher.match(location)
    }
}

VueRouter.install = install

export default VueRouter
```
上面做这么多都是在处理配置选项，现在开始真正处理路由。由于路由是分hash和history模式的（源码还有abstract模式，由于前端用不上所以按下不表），但是这两种模式又有共同的地方，所以源码中使用基类加派生类的方式实现：

```
history
|--abstract.js
|--base.js
|--hash.js
|--html5.js
```
base为基类，主要是几种模式共同的处理，hash、html5、abstract.对应的各种模式特定的处理， 前面已经说了本文主要实现hash模式。

再回头看看终极目标：根据路由地址，来渲染不同的视图，所以接下来要做的事情：
- 1、获取当前路由地址：getCurrentLocation()
- 2、获取当前需要渲染的组件：translateTo()
- 3、添加路由监听事件: setupListeners()

由于1、3不同模式处理不同，所以放到hash.js里面处理，2是共同的所以放到base.js里面

**vue-router/history/hash.js**

```
import History from './base'

export default class HashHistory extends History{
  constructor(router){
    super(router) // 将VueRouter实例传送给基类

    ensureSlash() // 确保地址包含斜杠
  }

  getCurrentLocation(){
    return getHash()
  }

  setupListeners(){
    window.addEventListener('hashchange', ()=>{
      this.translateTo(getHash())
    })
  }
}

function getHash(){
  return window.location.hash.slice(1) // Firefox会不兼容
}

// 确保地址包含斜杠
function ensureSlash(){
  const hash = getHash()
  if (hash) {
    return true
  }
  window.location.hash = '/'
  return false
}
```
hash里面除开上面所说的getCurrentLocation()和setupListeners()，还调用了ensureSlash(),该方法主要是确保路径地址包含斜杠，例如地址栏输入：http://localhost:8080/ 会自动变成http://localhost:8080/#/，从而拿到hash值“/”，然后根据“/”再匹配到对应的组件。


**vue-router/history/base.js**

```
import { createRoute } from '../util/route'

export default class History{
  constructor(router){
    this.router = router // VueRouter实例
    this.current = createRoute(null, {
      path: '/'
    })
  }

  translateTo(location, onComplete){
    let route = this.router.match(location)
    
    if(location === this.current.path && route.matched.length === this.current.matched.length) return
    
    this.updateRoute(route)
    
    onComplete && onComplete()
  }

  updateRoute(route){
    this.current = route
  }
}
```
base里面将当前路由相关信息保存在current属性上，用它来搞事情。

实现完了，当然是要用起来了，回到VueRouter类：

**vue-router/index.js**
```
import createMatcher from './create-matcher'
import HashHistory from './history/hash'
import install from './install'
class VueRouter{
 constructor(options){
  this.routes = options.routes || [] // 传入的路由数组
  this.mode = options.mode || 'hash'
    
  this.matcher = createMatcher(this.routes) // {match}

  // 新添加
  this.history = new HashHistory(this)
 }

 // 新添加
 init(app){ // app指向根组件实例
   const history = this.history

   // 对location解析完后添加事件监听
   const setupListeners = ()=>{
    history.setupListeners()
   }
   history.translateTo(history.getCurrentLocation(), setupListeners) // 跟进当前路由找到对应的matched
 }
 match(location){
   return this.matcher.match(location)
 }
}

VueRouter.install = install

export default VueRouter
```
VueRouter类里面构造函数里面实例化了HashHistory类，然后添加了init()初始化方法，这个方法会在根组件beforeCreate钩子函数里面调用：

**vue-router/install.js**

```
function install(Vue){
    // 全局注册一个混入
  Vue.mixin({
    beforeCreate() {
      // 这个钩子函数会从父往子去依次执行
      if(this.$options.router){ // 只有根实例上才有router选项
        this._routeRoot = this
        this._router = this.$options.router // new VueRouter() VueRouter类的实例
        
        // 新添加
        this._router.init(this)

      }else{
        // 每个子组件都添加一个_routeRoot属性指向根实例，用来获取跟实例的router
        this._routeRoot = this.$parent && this.$parent._routeRoot 
      }
    },
  })
  
  Object.defineProperty(Vue.prototype, '$router', {
    get(){
      return this._routeRoot._router // 返回跟实例上的VueRouter实例
    }
  })
}
```

到此为止，已经实现了根据当前路径获取路由信息（主要是对应的组件），并且在hash变化时会重新获取，但是我们的最终目标是动态渲染视图，由于是基于Vue框架，自带MVVM光环，所以只要定义一个响应式的状态便自动实现。

这个响应式的数据状态在哪个组件最合适呢？不用说肯定是根组件了。


**vue-router/install.js**

```
function install(Vue){
  // 全局注册一个混入
  Vue.mixin({
    beforeCreate() {
      // 这个钩子函数会从父往子去依次执行
      if(this.$options.router){ // 只有根实例上才有router选项
        this._routeRoot = this
        this._router = this.$options.router // new VueRouter() VueRouter类的实例

        this._router.init(this) // 注意，这里将this传递给init()
        
       // 新添加
        Vue.util.defineReactive(this, '_route', this._router.history.current) // 往根实例上注入一个响应式属性，默认值是current
      }else{
        // 每个子组件都添加一个_routeRoot属性指向根实例，用来获取跟实例的router
        this._routeRoot = this.$parent && this.$parent._routeRoot 
      }
    },
  })
  
  Object.defineProperty(Vue.prototype, '$router', {
    get(){
      return this._routeRoot._router // 返回跟实例上的VueRouter实例
    }
  })

  // 新添加
  Object.defineProperty(Vue.prototype, '$route', {
    get(){
      return this._routeRoot._route // 返回根实例上的_route属性值
    }
  })

}
```

在根组件上添加了一个_route响应式状态，并且将这个状态和$router一样，注入到各个子组件，所以在子组件里面可以通过this.$route来获取路由的相关属性，如path、hash、matched等，当然本文没有全部实现，但到这里实现以非难事。官网传送门：[路由对象属性](https://router.vuejs.org/zh/api/#%E8%B7%AF%E7%94%B1%E5%AF%B9%E8%B1%A1%E5%B1%9E%E6%80%A7)

_route属性在beforeCreate钩子函数里面进行了初始化，路由变化时也需要更新，由于调用init()方法时传入了根实例app参数，所以app._route设置为新值即触发更新。

**vue-router/index.js**
```
import createMatcher from './create-matcher'
import HashHistory from './history/hash'
import install from './install'
class VueRouter{
 constructor(options){
  this.routes = options.routes || [] // 传入的路由数组
  this.mode = options.mode || 'hash'
    
  this.matcher = createMatcher(this.routes) // {match}

  this.history = new HashHistory(this)
 }

 // app指向根组件实例
 init(app){
   const history = this.history

   // 对location解析完后添加事件监听
   const setupListeners = ()=>{
    history.setupListeners()
   }
   history.translateTo(history.getCurrentLocation(), setupListeners) // 跟进当前路由找到对应的matched
   
   // 新添加
   // 路由变化后需要更新根实例上的_route属性，由于_route是响应式的，所以会更新对应视图
   // 初始化时是不需要触发的，所以放在translateTo后面
   history.listen( route =>{
    app._route = route
   })
 }
 match(location){
   return this.matcher.match(location)
 }
}

VueRouter.install = install

export default VueRouter
```
由于路由变化是在history里面实现的，所以这里调用了history.listen()方法，具体实现：

**vue-router/history/base.js**

```
import { createRoute } from '../util/route'

export default class History{
  constructor(router){
    this.router = router // VueRouter实例
    this.current = createRoute(null, {
      path: '/'
    })
  }

  translateTo(location, onComplete){
    let route = this.router.match(location)
    
    if(location === this.current.path && route.matched.length === this.current.matched.length) return
    
    this.updateRoute(route)
    
    onComplete && onComplete()
  }

  updateRoute(route){
    this.current = route
    
    // 新添加
    this.cb && this.cb(route) //这里会设置app._route从而触发更新
  }
  
  // 新添加
  listen( cb ){
    this.cb = cb // 将触发更新的回调存储起来
  }
}
```

响应式的数据有了，只差最后一步：组件渲染，也就是router-view组件的实现

思考一下，router-view组件并不适合常规的基于模板的组件，而更适合使用渲染函数，而且组件没有任何状态，也没有监听任何传递给它的状态，也没有生命周期方法，只是单纯的渲染对应的组件，所以更适合函数式组件，官网传送门：[函数式组件](https://cn.vuejs.org/v2/guide/render-function.html#%E5%87%BD%E6%95%B0%E5%BC%8F%E7%BB%84%E4%BB%B6)

接着思考，怎样获取需要渲染的组件？函数式组件是无状态的，没有this上下文，但render方法的第二个参数context代表上下文，那么就可以通过context.parent来获取外层的父组件，由于之前已经将$route注入到各个子组件，所以context.parent.$route.matched就可以获取到所有需要的组件。

再接着思考，matched返回的是一个数组，例如当前path是'/about/a'，那么matched = [About, A]，那怎么知道当前是渲染About还是A呢？

渲染都是从父组件然后子组件，所以第一次肯定会是About组件，第二次渲染，也就是About组件里面 <router-view>就需要渲染A组件了，源码里面处理的很巧妙：设置一个变量deep，默认为0，也就是默认取第一个，然后给每个 <router-view>渲染的组件的data里面注入一个标识routerView，再通过while循环不断查找父组件的data里面是否有routerView，如果有，则deep++，最后根据deep来获取数组matched里面对应的组件。

思考完毕，coding time:

**vue-router/compontent/view.js**

```

export default {
  name: 'RouterView',
  functional: true, // 函数式组件
  render(h, context){
   
    let parent = context.parent
    const data = context.data
    data.routerView = true // 给router-view渲染的组件打上标识
    const route = parent.$route // 注入到每个子组件的实例属性$route
    
    let deep = 0

    while(parent && parent !== parent._routeRoot){
      const vdata = parent.$vnode ? parent.$vnode.data : {}

      if(vdata.routerView){
        deep++
      }

      parent = parent.$parent // 不断往上找到router-vew渲染的组件
    }

    const matched = route.matched[deep]
    const component = matched && matched.component 
    
    if(!matched || !component){ return h() } // 如果没有匹配到组件，则渲染空

    return h(component, data) // 将data传递给该组件
  }
}
```
最后，注册全局组件：

**vue-router/install.js**

```
import RouterView from './compontent/view'

function install(Vue){
  // 全局注册一个混入
  Vue.mixin({
    beforeCreate() {
      // 这个钩子函数会从父往子去依次执行
      if(this.$options.router){ // 只有根实例上才有router选项
        this._routeRoot = this
        this._router = this.$options.router // new VueRouter() VueRouter类的实例

        this._router.init(this)
        
        Vue.util.defineReactive(this, '_route', this._router.history.current) // 往根实例上注入一个响应式属性，默认值是current
      }else{
        // 每个子组件都添加一个_routeRoot属性指向根实例，用来获取跟实例的router
        this._routeRoot = this.$parent && this.$parent._routeRoot 
      }
    },
  })
  
  Object.defineProperty(Vue.prototype, '$router', {
    get(){
      return this._routeRoot._router // 返回跟实例上的VueRouter实例
    }
  })

  Object.defineProperty(Vue.prototype, '$route', {
    get(){
      return this._routeRoot._route // 返回根实例上的_route属性值
    }
  })
  
  // 新添加
  // 注册全局组件
  Vue.component('router-view',RouterView)

}
```
到这里我们最开始定的目标就实现了，项目结构整理如下：

![项目结构](https://rhinosystem.bs2dl.yy.com/cont1611888543089915file)

执行效果：

![执行效果](https://rhinosystem.bs2dl.yy.com/cont1611819860951489file)


GitHub地址：[https://github.com/littleyan-xu/vue-router](https://github.com/littleyan-xu/vue-router)

还有一些常用的基本功能上面没有实现，其实也是对上面一些方法的调用或加强，这里也顺便提下：

1、addRoutes(routes)：动态添加路由

routes参数也是一份用户配置，所以其实最主要的是动态更改上面的pathList、pathMap

**create-route-map.js改造**

```
export default function createRouteMap(routes, oldPathList, oldPathMap){
  let pathList = oldPathList || []
  let pathMap = oldPathMap || Object.create(null)

  routes.forEach(route => {
    addRouteRecord(route, pathList, pathMap)
  });

  return {
    pathList,
    pathMap
  }
}
```
**create-matcher.js改造**

```
export default function createMatcher(routes){
  let {pathList, pathMap} = createRouteMap(routes) // 初始化配置

  // 新添加
  function addRoutes(newRoutes){
    createRouteMap(newRoutes, pathList, pathMap) // 将之前获得的数据再传回去添加
  }

  function match(location){
    // 省略...
  }

  return {
    addRoutes, // 新添加
    match
  }
}
```
**vue-router/index.js改造**


```
class VueRouter{
    constructor(options){
        // 省略...
        this.matcher = createMatcher(this.routes) // {addRoutes, match}
        // 省略...
    }
    addRoutes(routes){
        this.matcher.addRoutes(routes)
        this.history.transitionTo(this.history.getCurrentLocation())
    }
}


```

2、this.$router.push()：跳转路由

在install.js里面设定$router指向了VueRouter实例，所以push是实例的方法

**vue-router/index.js改造**

```
push(location, onComplete){
    this.history.push(location, onComplete)
}
```
由于不同模式处理路由方式是不同的，所以具体的实现放在hash.js里面实现

**hash.js改造**

```
push(location, onComplete){
    this.transitionTo(
      location,
      route => {
        window.location.hash = route.path
        onComplete && onComplete(route)
      })
}
```

篇幅有限，这里不继续赘述，掌握了核心原理，再去添砖加瓦也以非难事，当然源码里面实现的会更细致更健壮，VueRouter源码传送门：https://github.com/vuejs/vue-router

























