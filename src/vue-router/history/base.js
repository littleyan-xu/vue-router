import { createRoute } from '../util/route';
/**
 * @param {*} record map里面存放的记录
 * @param {*} location 路径
 */
export default class History{
  constructor(router){
    this.router = router // VueRouter实例
    this.current = createRoute(null, {
      path: '/'
    })
  }

  /**
   * 
   * @param {*} location 当前路径
   * @param {*} onCompate 完成后的回调
   */
  translateTo(location, onComplete){
    // route = {
    //   path:'/xxx',
    //   mathed:[]
    // }
    let route = this.router.match(location)
    console.log(route);
    if(location === this.current.path && route.matched.length === this.current.matched.length) return
    this.updateRoute(route)
    onComplete && onComplete()
  }

  updateRoute(route){
    this.current = route

    this.cb && this.cb(route) //这里会设置app._route从而触发更新
  }

  listen( cb ){
    this.cb = cb // 将触发更新的回调存储起来
  }
}