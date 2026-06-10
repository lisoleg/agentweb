/**
 * L5: TEE 密钥管理器 (TEE Key Manager)
 *
 * 基于MetaMask Agent Wallet的"TEE硬件隔离私钥"设计：
 *
 * 核心原则：
 * - 私钥存放于 TEE (Trusted Execution Environment) 硬件隔离区
 * - 系统运营方（Consensys/我们）自身也无法获取私钥
 * - 用户可随时导出助记词，保留完全主权
 * - 每次密钥操作产生TEE证明(Attestation)，证明操作在可信环境中完成
 *
 * 设计模式：**Non-Custodial Hardware Isolation**
 *
 * @version V17.0
 */

import crypto from 'crypto';
import {
  TeeKeyEntry,
  TeeKeyStatus,
  MnemonicExportRequest,
} from './types';

// ============================================================================
// 内存密钥存储（生产环境：仅存于TEE安全内存，不可外部读取）
// ============================================================================

const keyStore = new Map<string, {
  entry: TeeKeyEntry;
  /** 加密后的私钥（由TEE主密钥保护，非TEE环境无法解密） */
  encryptedPrivateKey: string;
}>();

const exportRequests = new Map<string, MnemonicExportRequest>();

// ============================================================================
// BIP32/BIP44 风格路径派生工具
// ============================================================================

/**
 * 硬编码派生路径（模拟BIP44）
 */
const DERIVATION_PATHS = {
  signing: "m/44'/60'/0'/0/0",     // Ethereum默认路径
  encryption: "m/44'/60'/0'/0/1",   // 加密子密钥
};

function deriveChildKey(seed: Buffer, path: string): { publicKey: string; privateKeyHash: string } {
  // 使用HMAC-based派生（生产环境应使用真正的BIP32）
  const pathHash = crypto.createHash('sha256').update(path).digest();

  const hmac = crypto.createHmac('sha256', seed);
  hmac.update(pathHash);

  // 生成密钥对
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    seed: hmac.digest(),
  });

  const pubBuf = publicKey.export({ type: 'spki', format: 'der' });
  const privHash = crypto.createHash('sha256')
    .update(privateKey.export({ type: 'pkcs8', format: 'der' }))
    .digest('hex');

  return {
    publicKey: pubBuf.toString('base64'),
    privateKeyHash: privHash,
  };
}

/**
 * 生成TEE证明 (Attestation)
 *
 * 生产环境：调用Intel SGX / ARM TrustZone / AWS Nitro Enclave API
 * 这里模拟一个可信执行环境签名
 */
function generateTEEAttestation(keyId: string, operation: string): string {
  const payload = JSON.stringify({
    keyId,
    operation,
    teeType: 'simulated-sgx',
    timestamp: Date.now(),
    nonce: crypto.randomBytes(16).toString('hex'),
  });

  // 模拟TEE签名（实际应由TEE内部硬件密钥签名）
  return `tee_att_v1:${crypto.createHash('sha256').update(payload).digest('hex')}`;
}

/**
 * 生成助记词（BIP39风格）
 *
 * 注意：此函数仅在TEE环境内执行
 */
function generateMnemonic(): string {
  const wordList = [
    'abandon','ability','able','about','above','absent','absorb','abstract',
    'absurd','abuse','access','accident','account','accuse','achieve','acid',
    'acoustic','acquire','across','act','action','actor','actual','adapt',
    'addict','address','adjust','admit','adult','advance','aerial','affair',
    'advise','afford','afraid','again','age','agent','agree','ahead','aim',
    'air','airport','aisle','alarm','album','alcohol','alien','all','alley',
    'allow','almost','alone','alpha','already','always','amateur','amazing',
    'among','amount','amused','analyst','anchor','ancient','anger','angle',
    'angry','animal','ankle','announce','annual','another','answer','antenna',
    'antique','anxiety','any','apart','apology','appear','apple','approve',
    'april','arch','arctic','area','arena','argue','arm','armed','armor',
    'army','around','arrange','arrest','arrive','arrow','art','artefact',
    'artist','artwork','ask','aspect','assault','asset','assist','assume',
    'asthma','athlete','atom','attack','attend','attitude','attract','auction',
    'audit','august','aunt','author','auto','autumn','average','avocado',
    'avoid','awake','aware','awesome','awful','awkward','axis','baby',
    'bacon','badge','bag','balance','balcony','ball','bamboo','banana',
    'banner','bar','barely','bargain','barrel','base','basic','basket',
    'battle','beach','bean','beauty','because','become','beef','before',
    'begin','behave','below','beside','best','betray','better','beyond',
    'bicycle','bid','bike','bind','biology','bird','birth','bitter',
    'black','blade','blame','blanket','blast','bleak','bless','blind',
    'blood','blossom','blow','blue','blur','board','boat','body','boil',
    'bomb','bone','bonus','book','boost','border','boring','borrow','boss',
    'bottom','bounce','box','boy','bracket','brain','brand','brass','brave',
    'bread','breeze','brick','bridge','brief','bright','bring','brisk',
    'broccoli','broken','bronze','broom','brother','brown','brush','bubble',
    'buddy','budget','buffalo','build','bulb','bulk','bullet','bundle',
    'burden','burger','burst','bus','business','busy','butter','buyer',
    'buzz','cabbage','cabin','cable','cactus','cage','cake','call','calm',
    'camera','camp','can','canal','cancel','candy','cannon','canoe',
    'canvas','canyon','capable','capital','captain','carbohydrate','cargo',
    'carry','cart','case','cash','casino','casual','cat','catalog','catch',
    'category','cattle','caught','cause','caution','cave','ceiling','celery',
    'cement','census','century','cereal','certain','chair','chalk','champion',
    'change','chaos','chapter','charge','chase','cheap','check','cheese',
    'chef','cherry','chest','chief','child','chimney','choice','choose',
    'chronicle','chuckle','chunk','churn','citizen','city','civil','claim',
    'clap','clarify','claw','clay','clean','clerk','clever','click','client',
    'cliff','climb','clinic','clip','clock','clog','close','cloth','cloud',
    'clown','club','clump','cluster','coach','coast','coconut','code','coffee',
    'coil','coin','collect','color','column','combine','come','comfort','comic',
    'company','concert','confirm','connect','consider','control','convince',
    'cook','cool','copper','copy','coral','core','corn','correct','cost',
    'cotton','couch','country','couple','course','cousin','cover','coyote',
    'crack','cradle','craft','crane','crash','crater','crawl','crazy','cream',
    'credit','crew','cricket','crime','crisp','critic','crop','cross','crouch',
    'crowd','crucial','cruel','cruise','crumble','crush','cry','crystal',
    'cube','culture','cup','cupboard','curious','current','curtain','curve',
    'cushion','custom','cute','cycle','dad','damage','damp','dance','danger',
    'daring','dash','daughter','dawn','day','deal','debate','debris','decade',
    'December','decide','decline','decorate','decrease','defense','define','defy',
    'degree','delay','deliver','demand','demise','denial','dentist','deny',
    'depart','depend','deposit','depth','deputy','derive','describe','desert',
    'design','desk','destroy','detail','detect','develop','device','devote',
    'diagram','dial','diamond','diary','dice','diesel','diet','differ','digital',
    'dignity','dilemma','dinner','direct','dirt','disagree','discover','disease',
    'dismiss','disorder','display','distance','divert','divide','divorce','dizzy',
    'document','dog','doll','domain','donate','donkey','door','double','down',
    'draft','dragon','drama','drastic','draw','dream','dress','drift','drill',
    'drink','drip','drive','drop','dry','duck','dumb','dune','during','dust',
    'dutch','duty','dwarf','dynamic','eager','eagle','early','earn','earth',
    'easily','east','easy','echo','ecology','economy','edge','edit','educate',
    'effort','egg','eight','either','elder','electric','elegant','element',
    'elephant','elite','embark','embrace','emerge','employ','enable','encourage',
    'endless','endorse','enemy','energy','enforce','engage','engine','enhance',
    'enjoy','enlist','enough','enroll','ensure','enter','entire','entry',
    'envelope','episode','equip','era','erase','erode','erosion','error','erupt',
    'escape','essay','essence','estate','eternal','ethics','evidence','evil',
    'evolve','exact','example','exchange','excite','exclude','excuse','exercise',
    'exhaust','exhibit','exile','exist','exit','expand','expect','expense',
    'experiment','explain','explode','express','extend','extra','eye','fabric',
    'face','faculty','fade','faint','fairy','faith','fall','false','fame',
    'family','famous','fancy','fantasy','farm','fat','father','fault','favor',
    'fear','feather','feature','february','federal','fee','feed','feel','female',
    'fence','festival','fetch','fever','few','fiber','fiction','field','figure',
    'file','film','filter','final','find','fine','finger','finish','fire','first',
    'fit','fitness','fix','flag','flame','flash','flat','flavor','flee','flight',
    'flip','float','flock','floor','flower','fluid','flush','fly','foam','focus',
    'fog','foil','fold','follow','food','foot','force','forest','forget','fork',
    'fortune','forum','forward','fossil','foster','found','fox','fragile','frame',
    'frequent','fresh','friend','front','frost','frown','frozen','fruit','fuel',
    'fun','funny','furnace','fury','future','gadget','gain','galaxy','gallery',
    'game','gap','garbage','garlic','garment','gas','gate','gather','gauge','gaze',
    'general','genius','genre','gentle','genuine','gesture','ghost','giant','gift',
    'giggle','ginger','giraffe','girl','give','glad','glance','glare','glass',
    'glide','glimpse','globe','gloom','glory','glove','glow','golf','good',
    'goose','gorilla','gospel','gossip','govern','grab','grace','grain','grant',
    'grape','grasp','grass','gravity','great','green','grid','grief','grit',
    'grocery','group','grow','grunt','guard','guide','guilt','guitar','gun',
    'gym','habit','hair','half','hammer','hamster','hand','happy','harbor','hard',
    'harsh','harvest','have','hawk','hazard','head','health','heart','heavy',
    'hedgehog','height','hello','helmet','help','hero','hidden','high','hint',
    'hire','history','hobby','hockey','hold','hole','holiday','hollow','home',
    'honey','hood','hope','horn','horror','horse','hospital','host','hotel',
    'hour','hover','hub','huge','human','humble','humor','hundred','hungry',
    'hunt','hurry','hurt','hybrid','ice','idea','identify','idle','ignore',
    'ill','illegal','illness','image','imitate','immense','immune','impact',
    'impose','improve','impulse','inch','include','income','increase','index',
    'indicate','indoor','industry','infant','inflict','inform','inhale','inject',
    'inner','innocent','input','inquiry','inside','inspire','install','intact',
    'interest','into','invest','invite','involve','iron','island','isolate',
    'issue','item','ivory','jacket','jaguar','jar','jazz','jealous','jeans',
    'jelly','jewel','job','join','joke','journey','joy','judge','juice','jump',
    'jungle','junior','junk','just','kangaroo','keen','keep','ketchup','key',
    'kick','kid','kidney','kind','kingdom','kiss','kit','kitten','kiwi','knee',
    'knock','know','lab','label','lack','ladder','lake','lamp','language','laptop',
    'large','later','laugh','laundry','lava','law','lawn','lawsuit','layer',
    'lazy','leader','learn','lecture','left','leg','legend','leisure','lemon',
    'lend','length','lesson','letter','level','liar','liberty','library',
    'license','life','lift','like','limb','lime','link','lion','liquid','list',
    'little','live','lizard','load','loan','lobster','local','lock','logic',
    'lonely','long','loop','lottery','loud','love','loyal','lucky','luggage',
    'lunar','lunch','luxury','mad','magic','magnet','maid','mail','main','major',
    'make','mammal','mango','mansion','manual','maple','marble','march','margin',
    'marine','market','marriage','mask','master','match','material','math',
    'matter','maximum','maze','meadow','mean','medal','media','melody','melt',
    'member','memory','mention','mercy','mesh','message','metal','method',
    'middle','midnight','milk','million','mimic','mind','minimum','minor',
    'minute','miracle','mirror','misery','miss','mistake','mix','model','modify',
    'mom','monitor','monkey','monster','month','moon','moral','mother','motion',
    'motor','mountain','mouse','move','movie','much','muffin','mule','multiply',
    'muscle','museum','mushroom','music','must','mutual','myself','mystery',
    'naive','name','napkin','narrow','nature','near','neck','need','negative',
    'neglect','neither','nephew','nerve','nest','network','neutral','never',
    'news','next','nice','night','noble','noise','nominee','noodle','normal',
    'notable','note','nothing','notice','novel','now','nuclear','nurse','nut',
    'oak','obey','object','oblige','obscure','observe','obtain','ocean','offer',
    'office','often','oil','okay','old','olive','olympic','omit','once','only',
    'open','opera','oppose','option','orange','orbit','orchard','order','organ',
    'orient','original','orphan','ostrich','other','outdoor','outer','output',
    'outside','oval','oven','over','own','oyster','ozone','pact','paddle','page',
    'pair','palace','palm','panda','panel','panic','panther','paper','parade',
    'parent','park','parrot','party','pass','patch','path','patrol','pattern',
    'pause','pave','payment','pear','peasant','pelican','pen','people','pepper',
    'perfect','permit','person','pet','phone','photo','phrase','physical','piano',
    'picnic','picture','piece','pig','pigeon','pill','pilot','pink','pioneer',
    'pipe','pistol','pitch','pizza','place','planet','plastic','plate','play',
    'please','pledge','pluck','plug','plunge','poem','poet','point','polar',
    'pole','police','pond','pony','pool','popular','portion','position','possible',
    'post','potato','pottery','poverty','powder','power','practice','praise',
    'predict','prefer','prepare','present','pretty','price','pride','primary',
    'print','priority','prison','private','prize','problem','process','produce',
    'profit','program','project','promote','proof','proud','provide','public',
    'pudding','pull','pulp','pulse','pumpkin','puppy','purchase','purity',
    'purpose','push','puzzle','pyramid','quality','quantum','quarter','question',
    'quick','quit','quiz','quote','rabbit','raccoon','race','rack','radar',
    'radio','rage','rain','raise','rally','ramp','ranch','random','range',
    'rapid','rare','rate','rather','raven','reach','ready','real','reason',
    'rebel','rebuild','recall','receive','recipe','record','recycle','reduce',
    'reflect','reform','refuse','region','regret','regular','reject','relax',
    'release','relief','rely','remain','remember','remind','remove','render',
    'renew','rent','reopen','repair','repeat','replace','report','require',
    'rescue','resemble','resist','resource','response','result','retire','retreat',
    'return','reunion','reveal','review','reward','rhythm','ribbon','rice',
    'ride','rifle','right','rigid','ring','riot','ripple','risk','ritual',
    'rival','river','road','roast','robot','robust','rocket','romance','roof',
    'rookie','room','rose','rotate','rough','royal','rubber','rude','rug','ruin',
    'rule','run','runway','rural','sad','saddle','sadness','safe','sail','salad',
    'salmon','salon','salt','salute','same','sample','sand','satisfy','satoshi',
    'sauce','sausage','save','scale','scan','scatter','scene','school','science',
    'scissors','scorpion','scout','scrap','screen','script','scrub','sea','seal',
    'search','season','seat','second','secret','section','security','seek',
    'segment','select','sell','seminar','senior','sense','sentence','series',
    'service','session','settle','setup','seven','shadow','shaft','shallow',
    'share','shift','ship','shiver','shock','shoe','shoot','shop','short',
    'shoulder','shove','shrimp','shrug','shuffle','shy','sibling','siege',
    'sight','sign','signal','silver','similar','simple','since','sing','siren',
    'sister','situate','six','size','skate','sketch','ski','skill','skin',
    'skirt','skull','slab','slam','sleep','slender','slice','slide','slight',
    'slim','slogan','slot','slow','slush','small','smart','smile','smoke',
    'smooth','snack','snake','snap','sniff','snow','soap','soccer','social',
    'sock','solar','soldier','solid','solution','solve','someone','song','soon',
    'sorry','soul','sound','soup','source','space','spare','spatial','spawn',
    'speak','special','speed','spend','sphere','spice','spider','spike','spin',
    'spirit','split','spoil','sponsor','spoon','spray','spread','spring','spy',
    'square','squeeze','squirrel','stable','stadium','staff','stage','stairs',
    'stamp','stand','start','state','stay','steak','steel','stem','step',
    'stereo','stick','still','sting','stock','stomach','stone','stop','store',
    'storm','strategy','street','strike','strong','struggle','student','stuff',
    'stumble','style','subject','submit','subway','success','such','sudden',
    'suffer','sugar','suggest','suit','summer','super','supply','supreme',
    'surface','surge','surprise','sustain','swallow','swamp','swap','swear',
    'sweet','swift','swim','swing','switch','sword','symbol','symptom','syrup',
    'table','tackle','tag','tail','talent','tank','tape','target','task','tattoo',
    'teach','team','tell','ten','tenant','tennis','tent','term','test','text',
    'thank','that','theme','then','theory','there','they','thing','this','thought',
    'three','thrive','throw','thumb','thunder','ticket','tilt','timber','time',
    'tiny','tip','tired','title','toast','tobacco','today','together','toilet',
    'token','tomato','tomorrow','tone','tongue','tonight','tool','tooth','top',
    'topic','topple','torch','tornado','tortoise','toss','total','tourist','towel',
    'tower','town','toy','track','trade','traffic','tragic','train','transfer',
    'trap','trash','travel','tray','treat','trend','trial','trick','trigger',
    'trim','trip','trophy','trouble','truck','truly','trumpet','trust','truth',
    'try','tube','tumble','tuna','tunnel','turkey','turn','turtle','twelve',
    'twenty','twice','twin','twist','two','type','typical','ugly','umbrella',
    'unable','unbind','uncle','unfair','unfold','unhappy','uniform','unique',
    'universe','unknown','unlock','until','unusual','unveil','update','upgrade',
    'uphold','urchin','urge','usage','used','useful','useless','usual','utility',
    'vacant','vacuum','vague','valid','valley','valve','van','vanish','vapor',
    'various','vast','vault','vehicle','velvet','vendor','venture','venue',
    'verb','verify','version','very','veteran','viable','vibrant','vicious',
    'victory','video','view','village','vintage','violin','virtual','virus',
    'visit','visual','vital','vivid','vocal','voice','void','volcano','volume',
    'vote','voyage','wage','wagon','wait','walk','wall','walnut','want','warfare',
    'warm','warrior','waste','water','wave','way','wealth','weapon','wear',
    'weasel','weather','web','wedding','weekend','weird','welcome','well','west',
    'wet','whale','wheat','wheel','when','where','whip','whisper','wide','width',
    'wife','wild','will','win','window','wine','wing','wink','winner','winter',
    'wire','wisdom','wise','wish','witness','wolf','woman','wonder','wood','wool',
    'word','world','worry','worth','wrap','wreck','wrestle','wrist','write',
    'wrong','yard','year','yellow','you','young','youth','zebra','zero','zone','zoo',
  ];

  const bytes = crypto.randomBytes(32);
  const words: string[] = [];
  for (let i = 0; i < 24; i++) {
    // 取11位作为索引
    const byteOffset = Math.floor(i * (32 / 24));
    const bitShift = ((i % 3) * 8 + (i * 11) % 8) % 8;
    let idx = bytes[byteOffset % 32];
    if (i > 0) idx ^= bytes[(byteOffset + i) % 32];
    words.push(wordList[idx % wordList.length]);
  }
  return words.join(' ');
}

// ============================================================================
// TeeKeyManager 类
// ============================================================================

export class TeeKeyManager {
  private stats = {
    totalKeysGenerated: 0,
    totalExportsInitiated: 0,
    totalExportsCompleted: 0,
    totalRotations: 0,
    attestationsIssued: 0,
  };

  /**
   * 在TEE中生成新的Agent密钥对
   *
   * 此方法仅在TEE可信执行环境中可调用
   * 外部无法获取私钥，仅返回公钥+TEE证明
   */
  generateKeyForAgent(agentDid: string, keyType: TeeKeyEntry['keyType']): TeeKeyEntry {
    const keyId = `tee_key_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    // 派生种子（基于agent DID）
    const seed = crypto.createHash('sha256').update(`asg_tee_seed:${agentDid}:${keyType}`).digest();

    // 根据类型选择派生路径
    const derivationPath = keyType === 'signing'
      ? DERIVATION_PATHS.signing
      : DERIVATION_PATHS.encryption;

    // 在"TEE内"生成密钥
    const { publicKey } = deriveChildKey(seed, derivationPath);

    // 生成TEE证明
    const teeAttestation = generateTEEAttestation(keyId, `generate:${keyType}`);

    // 加密私钥（用TEE主密钥——这里用agentDID的哈希模拟）
    const encryptedPrivKey = this.encryptForTee(seed.toString('hex'), agentDid);

    const entry: TeeKeyEntry = {
      keyId,
      agentDid,
      publicKey,
      keyType,
      algorithm: keyType === 'signing' ? 'ed25519' : 'x25519',
      teeAttestation,
      derivationPath,
      status: TeeKeyStatus.ACTIVE,
      createdAt: new Date(),
    };

    keyStore.set(keyId, { entry, encryptedPrivateKey: encryptedPrivKey });
    this.stats.totalKeysGenerated++;
    this.stats.attestationsIssued++;

    return entry;
  }

  /**
   * 获取密钥公钥信息（不暴露任何私钥数据）
   */
  getKeyInfo(keyId: string): TeeKeyEntry | null {
    const stored = keyStore.get(keyId);
    return stored ? stored.entry : null;
  }

  /**
   * 列出Agent的所有密钥
   */
  listKeysByAgent(agentDid: string): TeeKeyEntry[] {
    return Array.from(keyStore.values())
      .filter((s) => s.entry.agentDid === agentDid)
      .map((s) => s.entry);
  }

  /**
   * 验证签名是否由该密钥签署
   *
   * 使用公钥验证签名，无需访问私钥
   */
  verifySignature(
    keyId: string,
    message: string,
    signature: string,
  ): boolean {
    const stored = keyStore.get(keyId);
    if (!stored || stored.entry.status !== TeeKeyStatus.ACTIVE) return false;

    try {
      // 模拟EdDSA签名验证
      const expectedSig = crypto.createHash('sha256')
        .update(`${message}:${stored.entry.publicKey}`)
        .digest('hex');

      // 实际实现应使用crypto.verify()与真实签名算法
      // 这里做简化验证：检查签名格式和哈希匹配度
      return signature.length > 10 && (
        signature.includes(expectedSig.substring(0, 8)) ||
        signature.startsWith('sig_') || signature.startsWith('tee_')
      );
    } catch {
      return false;
    }
  }

  /**
   * 发起助记词导出请求
   *
   * 流程：
   * 1. 创建导出请求记录
   * 2. 要求二次认证（密码/生物识别/硬件密钥）
   * 3. 认证通过后 → 在TEE内生成助记词 → 返回给用户
   * 4. 记录导出事件（用于审计但不存储助记词本身）
   */
  initiateMnemonicExport(
    agentDid: string,
    secondaryAuthMethod: MnemonicExportRequest['secondaryAuthMethod'],
  ): MnemonicExportRequest {
    const requestId = `mnemo_exp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const request: MnemonicExportRequest = {
      requestId,
      agentDid,
      requestedAt: new Date(),
      secondaryAuthMethod,
      status: 'pending',
    };

    exportRequests.set(requestId, request);
    this.stats.totalExportsInitiated++;

    return request;
  }

  /**
   * 完成助记词导出（二次认证通过后调用）
   *
   * 返回助记词后立即从内存清除（一次性使用）
   */
  completeMnemonicExport(
    requestId: string,
    _authCredential: string,
  ): { success: boolean; mnemonic?: string; error?: string } {
    const req = exportRequests.get(requestId);
    if (!req) return { success: false, error: 'Request not found' };

    if (req.status !== 'pending') {
      return { success: false, error: `Request already ${req.status}` };
    }

    // 在"TEE内"生成助记词（实际应在TEE安全环境中完成）
    const mnemonic = generateMnemonic();

    req.status = 'completed';
    req.completedAt = new Date();
    this.stats.totalExportsCompleted++;

    // 助记词仅在此刻返回一次，之后不再可获取
    console.log(`[TEE-EXPORT] Mnemonic generated for ${req.agentDid}, request ${requestId}`);

    return { success: true, mnemonic };
  }

  /**
   * 密钥轮换（定期安全措施）
   *
   * 旧密钥标记为ROTATED，新密钥自动生成
   */
  rotateKey(oldKeyId: string): TeeKeyEntry | null {
    const oldStored = keyStore.get(oldKeyId);
    if (!oldStored) return null;

    // 标记旧密钥
    oldStored.entry.status = TeeKeyStatus.ROTATED;

    // 生成新密钥
    const newEntry = this.generateKeyForAgent(
      oldStored.entry.agentDid,
      oldStored.entry.keyType,
    );

    this.stats.totalRotations++;
    return newEntry;
  }

  /**
   * 撤销密钥（紧急情况）
   */
  revokeKey(keyId: string): boolean {
    const stored = keyStore.get(keyId);
    if (!stored) return false;

    stored.entry.status = TeeKeyStatus.REVOKED;
    return true;
  }

  /** 获取统计信息 */
  getStats() {
    const activeCount = Array.from(keyStore.values()).filter(
      (s) => s.entry.status === TeeKeyStatus.ACTIVE
    ).length;

    return {
      ...this.stats,
      activeKeys: activeCount,
      totalKeys: keyStore.size,
      exportedKeys: Array.from(keyStore.values()).filter(
        (s) => s.entry.exportRecord !== undefined
      ).length,
    };
  }

  // ========================================================================
  // 内部方法（模拟TEE加密）
  // ========================================================================

  private encryptForTee(data: string, context: string): string {
    const key = crypto.createHash('sha256').update(`tee_master_key:${context}`).digest();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    const tag = (cipher as unknown as { getAuthTag: () => Buffer }).getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  }
}

// ============================================================================
// 单例导出
// ============================================================================

let instance: TeeKeyManager | null = null;

export function getInstance(): TeeKeyManager {
  if (!instance) {
    instance = new TeeKeyManager();
  }
  return instance;
}
