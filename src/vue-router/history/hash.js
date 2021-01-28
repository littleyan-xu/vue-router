import History from './base'

export default class HashHistory extends History{
  constructor(router){
    super(router)

    ensureSlash() // 确定地址包含斜杠
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

// 确定地址包含斜杠
function ensureSlash(){
  const hash = getHash()
  if (hash) {
    return true
  }
  window.location.hash = '/'
  return false
}