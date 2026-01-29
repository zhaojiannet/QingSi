/**
 * 应用配置文件
 *
 * 修改此文件可自定义品牌信息，无需修改代码
 * 图片文件放在 public/images/ 目录下
 */

// 行业类型与背景图对应关系
const industryBgMap = {
  '美业': 'login_bg01.jpg',
  '美容': 'login_bg02.jpg',
  '美发': 'login_bg03.jpg',
  '美甲': 'login_bg04.jpg',
  '按摩': 'login_bg05.jpg',
  '瑜伽': 'login_bg06.jpg',
  '培训': 'login_bg07.jpg',
  '宠物': 'login_bg08.jpg',
};

export default {
  // 品牌名称（店铺名）
  brandName: '青丝',

  // 行业类型（修改此项会自动切换对应背景图）
  industryType: '美业',

  // 系统名称
  systemName: '会员管理系统',

  // 完整标题（用于浏览器标签页）
  get fullTitle() {
    return `${this.brandName} · ${this.industryType}${this.systemName}`;
  },

  // 登录页宣传语
  slogan: '简单高效，管理不用愁，经营更省心',

  // 资源文件路径（相对于 public 目录）
  logo: '/images/logo.png',

  // 登录页背景图（根据行业类型自动选择，也可手动指定）
  get loginBgImage() {
    return `/images/${industryBgMap[this.industryType] || 'login_bg01.jpg'}`;
  },
};
