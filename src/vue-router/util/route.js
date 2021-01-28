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