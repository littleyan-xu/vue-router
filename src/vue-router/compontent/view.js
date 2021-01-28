
export default {
  name: 'RouterView',
  functional: true, // 函数式组件
  render(h, context){
   
    let parent = context.parent
    const data = context.data
    data.routerView = true // 给router-view渲染的组件打上标识
    const route = parent.$route // 挂载到每个子组件的实例属性$route
    
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