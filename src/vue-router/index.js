import createMatcher from './create-matcher'
import HashHistory from './history/hash'
import install from './install'
class VueRouter{
 constructor(options){
  this.routes = options.routes || [] // 传入的路由数组


  this.matcher = createMatcher(this.routes) // {addRoutes, match}

  this.mode = options.mode || 'hash'

  switch (this.mode) {
    case 'hash':
      this.history = new HashHistory(this)
      break;
    default:
      break;
  }
 }

 // app指向根组件实例
 init(app){
   const history = this.history

   // 对location解析完后添加事件监听
   const setupListeners = ()=>{
    history.setupListeners()
   }
   history.translateTo(history.getCurrentLocation(), setupListeners) // 跟进当前路由找到对应的matched

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