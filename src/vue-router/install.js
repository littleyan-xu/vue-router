import RouterView from './compontent/view'
function install(Vue){
 //  console.log('install');

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
      // console.log(this._routeRoot._router);
    },
  })

  Object.defineProperty(Vue.prototype, '$route', {
    get(){
      return this._routeRoot._route // 返回根实例上的_route属性值
    }
  })

  Object.defineProperty(Vue.prototype, '$router', {
    get(){
      return this._routeRoot._router // 返回跟实例上的VueRouter实例
    }
  })

  // 注册全局组件
  Vue.component('router-view',RouterView)

}
export default install