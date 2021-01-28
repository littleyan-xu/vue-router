import createRouteMap from './create-route-map'
import { createRoute } from './util/route';
/**
 * 
 * @param {*} routes : 用户传入的路由配置
 */
export default function createMatcher(routes){
  let {pathList, pathMap} = createRouteMap(routes) // 初始化配置

  // console.log('pathList', pathList);
  console.log('pathMap', pathMap);

  function addRoutes(newRoutes){
    createRouteMap(newRoutes, pathList, pathMap)
  }

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
    addRoutes,
    match
  }
}
