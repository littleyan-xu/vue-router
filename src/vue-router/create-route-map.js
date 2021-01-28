
/**
 * 
 * @param {*} routes : 用户传入的路由配置
 * 将用户传入的路由配置格式化
 */
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

function addRouteRecord(route, pathList, pathMap, parent){
  let path = parent ? `${parent.path}/${route.path}` : route.path // 如果有父路径，则补全path
  let record = {
    path,
    component: route.component, // 用户配置的path所对应的component
    parent,
  }

  if(!pathMap[path]){// 如果Map里面没有
    pathList.push(path)
    pathMap[path] = record
  } 

  if(route.children){
    route.children.forEach(child => {
      addRouteRecord(child, pathList, pathMap, record) // 这里会传入parent，不能直接传route，会导致父和子不统一
    })
  }
}