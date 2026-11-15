import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import { Response } from 'express';

export function streamManualPdfToResponse(res: Response, basePath: string): void {
  const doc = new PDFDocument({
    margin: 36,
    size: 'A4',
    bufferPages: true,
    info: {
      Title: 'Sandana Hospital & Dudrucs Pharmacy Operations Manual 2026',
      Author: 'Sandana Health System Admin',
      Subject: 'Marg ERP 9+ Pharmacy, Doctor OPD, Reception & Admin Manual (Hindi/English)',
      Keywords: 'Hospital, Pharmacy, Marg ERP, Accounts, Masters, Doctor OPD, Reception, SOP',
    },
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    'attachment; filename="Sandana_Hospital_Operations_Manual_2026.pdf"'
  );

  doc.pipe(res);

  // Check and register Noto Sans Devanagari fonts for genuine Hindi rendering
  const devanagariRegular = '/usr/share/fonts/truetype/noto/NotoSansDevanagari-Regular.ttf';
  const devanagariBold = '/usr/share/fonts/truetype/noto/NotoSansDevanagari-Bold.ttf';
  const hasDevanagari = fs.existsSync(devanagariRegular) && fs.existsSync(devanagariBold);

  if (hasDevanagari) {
    doc.registerFont('Deva', devanagariRegular);
    doc.registerFont('Deva-Bold', devanagariBold);
  }

  const fontRegular = hasDevanagari ? 'Deva' : 'Helvetica';
  const fontBold = hasDevanagari ? 'Deva-Bold' : 'Helvetica-Bold';

  const primaryColor = '#0F2942';
  const emeraldColor = '#059669';
  const darkSlate = '#1E293B';
  const lightGray = '#64748B';
  const navyAccent = '#1E3A8A';

  const assetsDir = path.join(basePath, 'public/assets/aistudio');

  // Helper to add image if exists
  const tryAddImage = (filename: string, maxW = 500, maxH = 220) => {
    try {
      const fullPath = path.join(assetsDir, filename);
      if (fs.existsSync(fullPath)) {
        doc.moveDown(0.4);
        doc.image(fullPath, { fit: [maxW, maxH], align: 'center' });
        doc.moveDown(0.4);
      }
    } catch {
      // Graceful fallback
    }
  };

  const addSectionHeader = (title: string, subtitle?: string) => {
    doc.fontSize(15).fillColor(primaryColor).font(fontBold).text(title);
    doc.rect(36, doc.y + 2, 523, 2).fill(emeraldColor);
    doc.moveDown(0.6);
    if (subtitle) {
      doc.fontSize(9.5).fillColor(lightGray).font(fontRegular).text(subtitle);
      doc.moveDown(0.4);
    }
  };

  const addSubHeader = (title: string) => {
    doc.fontSize(11).fillColor(emeraldColor).font(fontBold).text(title);
    doc.moveDown(0.2);
  };

  const addParagraph = (text: string) => {
    doc.fontSize(8.5).fillColor(darkSlate).font(fontRegular).text(text, { lineGap: 1.5 });
    doc.moveDown(0.4);
  };

  const addBulletList = (items: string[]) => {
    items.forEach((item) => {
      doc.fontSize(8.5).fillColor(darkSlate).font(fontRegular).text(`• ${item}`, { lineGap: 1.5, indent: 10 });
    });
    doc.moveDown(0.4);
  };

  // -------------------------------------------------------------
  // COVER PAGE
  // -------------------------------------------------------------
  doc.rect(20, 20, 555, 802).lineWidth(2).stroke(primaryColor);
  doc.rect(24, 24, 547, 794).lineWidth(0.5).stroke(emeraldColor);

  doc.moveDown(1.5);
  doc
    .fontSize(11)
    .fillColor(emeraldColor)
    .font(fontBold)
    .text('SANDANA MULTISPECIALITY CLINIC & DUDRUCS PHARMACY', { align: 'center' });

  doc.moveDown(0.4);
  doc
    .fontSize(21)
    .fillColor(primaryColor)
    .font(fontBold)
    .text('अस्पताल संचालन निर्देशिका एवं प्रशिक्षण पुस्तक', { align: 'center' });

  doc.moveDown(0.2);
  doc
    .fontSize(14)
    .fillColor(navyAccent)
    .font(fontBold)
    .text('Hospital & Marg ERP 9+ Pharmacy Operations Manual (2026)', { align: 'center' });

  doc.moveDown(0.3);
  doc
    .fontSize(9.5)
    .fillColor(lightGray)
    .font(fontRegular)
    .text('चारों पोर्टल्स (फार्मेसी, डॉक्टर, रिसेप्शन, एडमिन) का संपूर्ण सचित्र, चरण-दर-चरण यूजर गाइड', {
      align: 'center',
    });

  doc.moveDown(0.8);
  tryAddImage('image_1d776de9.png', 480, 200);

  doc.moveDown(0.6);
  doc
    .fontSize(10.5)
    .fillColor(primaryColor)
    .font(fontBold)
    .text('इस पुस्तक में सम्मिलित मुख्य विषय एवं पोर्टल्स:', { align: 'center' });

  doc.moveDown(0.4);
  const portals = [
    '1. Marg ERP 9+ फार्मेसी पैनल - Masters, Transactions, Accounts, Digital, Books, GST, Stocks, Hot Keys',
    '2. डॉक्टर ओपीडी चैम्बर - लाइव मरीज कतार, डिजिटल प्रिस्क्रिप्शन (Rx), हस्तलिखित पर्ची अपलोड व इतिहास',
    '3. रिसेप्शन डेस्क - वॉक-इन टोकन जनरेशन, ओपीडी बुकिंग, स्लॉट क्लैश प्रोटेक्शन एवं पर्ची प्रिंट',
    '4. सुपर एडमिन ईआरपी - स्टाफ आरबीएसी (RBAC), डॉक्टर प्रबंधन, दैनिक मध्यरात्रि बैकअप व ऑडिट लॉग्स',
  ];
  portals.forEach((p) => {
    doc.fontSize(8.5).fillColor(darkSlate).font(fontRegular).text(p, { align: 'center', lineGap: 1.5 });
  });

  doc.moveDown(1.2);
  doc
    .fontSize(8.5)
    .fillColor(lightGray)
    .font(fontRegular)
    .text('अधिकृत एडमिन व स्टाफ प्रशिक्षण दस्तावेज · वर्ष 2026 लाइव रिलीज · AI Studio Cloud Build', {
      align: 'center',
    });

  // -------------------------------------------------------------
  // CHAPTER 1: SYSTEM OVERVIEW
  // -------------------------------------------------------------
  doc.addPage();
  addSectionHeader(
    'अध्याय 1: सिस्टम ओवरव्यू एवं समग्र कार्यप्रवाह (End-to-End Workflow)',
    'मरीज के क्लीनिक में आने से लेकर दवा मिलने तक की संपूर्ण डिजिटल प्रक्रिया'
  );

  addParagraph(
    'संदाना हेल्थकेयर सिस्टम एक एकीकृत, क्लाउड-सिंक्रनाइज़्ड अस्पताल प्रबंधन प्रणाली (HMS) है। इसमें मरीज के आगमन, डॉक्टर परामर्श, डिजिटल पर्ची और फार्मेसी में दवा बिलिंग तक का पूरा चक्र रीयल-टाइम में एक-दूसरे से जुड़ा हुआ है।'
  );

  addSubHeader('1.1 चारों पोर्टल्स एवं भूमिका-आधारित सुरक्षा (Role-Based Access Control)');
  addParagraph(
    'प्रत्येक स्टाफ सदस्य को अपने कार्यक्षेत्र के अनुसार अलग लॉगिन आईडी व पासवर्ड दिया जाता है:\n' +
    '1. सुपर एडमिन (/admin): पूरे अस्पताल की निगरानी, वित्तीय रिपोर्ट, नए स्टाफ/डॉक्टर जोड़ना व डेटाबेस बैकअप।\n' +
    '2. फार्मेसी पैनल (/pharmacy): Marg ERP 9+ दवा बिलिंग (POS), इन्वेंटरी, सप्लायर परचेज, एक्सपायरी व जीएसटी रिपोर्ट।\n' +
    '3. रिसेप्शन डेस्क (/reception): नए मरीज का पंजीकरण, टोकन निकालना, डॉक्टर अपॉइंटमेंट और परामर्श शुल्क जमा।\n' +
    '4. डॉक्टर ओपीडी चैम्बर (/doctor): ओपीडी कतार से मरीज को बुलाना, लक्षण व जांच दर्ज करना, और डिजिटल/हस्तलिखित पर्ची बनाना।'
  );

  tryAddImage('image_7892dea9.png', 420, 160);

  addSubHeader('1.2 मरीज की यात्रा का 4-चरणीय चक्र (Patient Journey SOP)');
  addBulletList([
    'चरण 1 (रिसेप्शन पंजीकरण): मरीज रिसेप्शन पर आता है। रिसेप्शनिस्ट नाम, उम्र और मोबाइल नंबर दर्ज करके डॉक्टर की पर्ची और टोकन नंबर प्रिंट करता है।',
    'चरण 2 (कतार प्रबंधन): मरीज वेटिंग लाउंज में बैठता है। स्क्रीन पर उसका टोकन नंबर दिखाई देता है।',
    'चरण 3 (डॉक्टर परामर्श): डॉक्टर अपने केबिन से "Call Next" दबाते हैं। मरीज की जांच कर डिजिटल पर्ची या पेन से लिखी पर्ची का फोटो अपलोड करते हैं।',
    'चरण 4 (फार्मेसी वितरण): मरीज फार्मेसी काउंटर पर आता है। फार्मासिस्ट सिस्टम में मरीज का मोबाइल या नाम डालकर प्रिस्क्रिप्शन देख लेता है और तुरंत दवा बिल बनाकर क्यूआर/कैश पेमेंट लेता है।',
  ]);

  // -------------------------------------------------------------
  // CHAPTER 2: PHARMACY MARG ERP 9+ PANEL (FULL DEEP DIVE)
  // -------------------------------------------------------------
  doc.addPage();
  addSectionHeader(
    'अध्याय 2: फार्मेसी पैनल संपूर्ण गाइड - Marg ERP 9+ (All Options & Menus)',
    'Marg ERP 9+ के मुख्य मेनू (Masters, Transactions, Accounts, Digital, Books, GST, Stocks, Hot Keys) का सचित्र विवरण'
  );

  addSubHeader('2.1 Marg ERP 9+ मुख्य मेनू बार परिचय (Top Menu Bar Overview)');
  addParagraph(
    'फार्मेसी पैनल के शीर्ष पर 14 मुख्य मेनू विकल्प दिए गए हैं (जैसा कि संलग्न स्क्रीनशॉट में दर्शाया गया है):'
  );

  tryAddImage('image_4f1572d1.png', 520, 45);

  addBulletList([
    'Masters (मास्टर मेनू): दवा आइटम मास्टर, साल्ट मास्टर, बैच मास्टर, लेजर खाता मास्टर और कंपनी सेटिंग्स।',
    'Transactions (लेन-देन मेनू): सेल बिलिंग, परचेज चालान, सेल रिटर्न (S/R), परचेज रिटर्न (P/R) और कोटेशन।',
    'Accounts (अकाउंट्स मेनू): रसीद वाउचर (Receipt), भुगतान वाउचर (Payment), रोकड़ व बैंक बही, लेजर अकाउंट और आउटस्टैंडिंग रिपोर्ट।',
    'Digital (डिजिटल सर्विसेज): डायनामिक यूपीआई क्यूआर कोड, व्हाट्सएप व एसएमएस बिलिंग, और ऑनलाइन बैंकिंग पेमेंट।',
    'Books (बहीखाता): रोकड़ बही (Cash Book), बैंक बही (Bank Book), जर्नल बही (Journal) और डे बुक (Day Book)।',
    'Final Reports (अंतिम वित्तीय रिपोर्ट): बैलेंस शीट, लाभ-हानि खाता (Profit & Loss), तलपट (Trial Balance) और ट्रेडिंग अकाउंट।',
    'Gst (जीएसटी रिपोर्ट): GSTR-1 (सेल), GSTR-2B (परचेज मिलान), GSTR-3B मासिक समरी और HSN टैक्स ऑडिट।',
    'e-Way (ई-वे बिल): ₹50,000 से अधिक के माल परिवहन के लिए सरकारी पोर्टल सिंक और ई-वे बिल जनरेशन।',
    'Stocks (स्टॉक इन्वेंटरी): स्टॉक स्टेटस, एफआईएफओ बैच, 90-दिन एक्सपायरी अलर्ट और री-ऑर्डर लिस्ट।',
    'Daily Reports (दैनिक रिपोर्ट): दैनिक विश्लेषण (MIS), सेल्स बुक, डिस्पैच समरी और आज का सकल लाभ (Gross Profit)।',
    'Reports (व्यापक रिपोर्ट): दवा-वार बिक्री विश्लेषण, सप्लायर खरीद तुलना और ऑपरेटर ऑडिट लॉग।',
    'Hot Keys (हॉट कीज): Alt+N, Alt+P, F1, F2, F10 और Esc जैसे की-बोर्ड शॉर्टकट।',
    'Links & Exit: बाहरी पोर्टल्स के त्वरित लिंक और सॉफ्टवेयर से सुरक्षित निकास।',
  ]);

  tryAddImage('image_ea47c9e5.png', 500, 190);

  // -------------------------------------------------------------
  // CHAPTER 2.2: MASTERS & TRANSACTIONS
  // -------------------------------------------------------------
  doc.addPage();
  addSectionHeader('2.2 मास्टर पैनल (Masters Panel) - संपूर्ण कार्यविधि');

  tryAddImage('MASTER_27786562.PNG', 260, 175);

  addSubHeader('1. Item Master (दवा आइटम मास्टर)');
  addParagraph(
    'फार्मेसी में बेची जाने वाली प्रत्येक दवा की मूल जानकारी Item Master में दर्ज होती है।\n' +
    '• कैसे दर्ज करें: Masters > Inventory Master > Item Master पर जाएं (Shortcut: F2).\n' +
    '• Item Name: दवा का ब्रांड नाम (उदा. Dolo 650mg, Augmentin 625 Duo, Pan 40mg).\n' +
    '• Salt / Generic: रासायनिक घटक (उदा. Paracetamol 650mg, Amoxicillin + Potassium Clavulanate).\n' +
    '• Category: Tablet, Syrup, Injection, Capsule, Drops, Ointment.\n' +
    '• HSN Code व GST: दवा का HSN (उदा. 300490) और GST स्लैब (0%, 5%, 12%, 18%).\n' +
    '• Re-Order Level: न्यूनतम स्टॉक सीमा (उदा. 15 स्ट्रिप्स)। स्टॉक कम होने पर सिस्टम लाल अलर्ट देगा।'
  );

  addSubHeader('2. Batch Master (बैच व एक्सपायरी मास्टर)');
  addParagraph(
    'एक ही दवा के अलग-अलग समय पर आने वाले स्टॉक को बैच के रूप में अलग रखा जाता है।\n' +
    '• Batch Number: निर्माता द्वारा दिया गया बैच (उदा. DL-9804, AG-2026).\n' +
    '• Expiry Date (माह/वर्ष): एक्सपायरी दिनांक (उदा. 11/2028)।\n' +
    '• FIFO ऑटो-सिलेक्शन: जब भी आप दवा बेचेंगे, सिस्टम अपने आप सबसे पहले एक्सपायर होने वाले बैच को ऊपर लाएगा ताकि पुराना स्टॉक पहले बिके।'
  );

  addSubHeader('3. Ledger Master (लेजर खाता मास्टर)');
  addParagraph(
    'डिस्ट्रीब्यूटरों (Suppliers), मरीजों (Debtors), डॉक्टरों और बैंक खातों का अलग-अलग खाता बनाया जाता है। इसमें जीएसटी नंबर, पता, क्रेडिट लिमिट और ओपनिंग बैलेंस दर्ज किया जाता है।'
  );

  doc.addPage();
  addSectionHeader('2.3 ट्रांजैक्शन पैनल (Transactions Panel) - SALE ENTRY व PURCHASE ENTRY');

  tryAddImage('image_3ede2b19.png', 500, 185);

  addSubHeader('1. Sale Entry & Sales History Split Screen (शॉर्टकट: Alt + N या F10)');
  addBulletList([
    'चरण 1 (नया बिल खोलें): की-बोर्ड पर Alt+N दबाएं या Transactions > Sale > Bill (ALT+N) पर क्लिक करें। बाईं ओर SALE ENTRY और दाईं ओर SALES HISTORY [ Click to Copy ] खुलेगा।',
    'चरण 2 (<-key to change Bill No.): गहरे हरे रंग की कर्सर पट्टी पर Left Arrow दबाकर Bill No. बदलें, या सीधे दवा का नाम टाइप करें / Enter दबाकर स्टॉक लिस्ट खोलें।',
    'चरण 3 (PRODUCT | PACK | BATCH | STRI | TAB. | M.R.P./S | AMOUNT): Enter दबाते हुए क्रमशः PACK, BATCH, STRI, TAB. और M.R.P./S भरें।',
    'चरण 4 (नीचे का टूलबार): HELP | SALE | PURC | SC | PC | COPY | PASTE | SR | GST | RIO | BE | CASH | VOU | HOLD | PRES | EARN | SAVE के सभी बटन सक्रिय हैं।',
    'चरण 5 (Esc बैक की व सेव): F10 या SAVE दबाकर बिल सेव व प्रिंट करें, और Esc दबाकर तुरंत मुख्य डेस्कटॉप पर वापस आएं।',
  ]);

  addSubHeader('2. Purchase Entry, Challan & Excel Import (शॉर्टकट: Alt + P / Alt + C)');
  tryAddImage('PURCHASE_CHALLAN_ENTRY_85e82830.PNG', 480, 155);
  addParagraph(
    'थोक सप्लायर से प्राप्त बिल या चालान दर्ज करें (Alt+P या Alt+C): सप्लायर का नाम, Entry No., Party No भरें या ऊपर दिए गए "Import Excel (.XLSX)" बटन से सीधे सप्लायर की एक्सेल शीट अपलोड करें। एक्सेल की सारी दवाइयां अपने आप इसी ग्रिड में मैन्युअल एंट्री की तरह भर जाएंगी और सेव करते ही नया बैच व स्टॉक तुरंत इन्वेंटरी में जुड़ जाएगा।'
  );

  addSubHeader('3. Sale Return (S/R - Alt+R) एवं Purchase Return (P/R)');
  addParagraph(
    '• Sale Return (S/R): मरीज द्वारा दवा वापस करने पर मूल बिल नंबर खोजें और वापस की गई संख्या दर्ज करें। स्टॉक तुरंत बढ़ जाएगा और मरीज को रिफंड रसीद मिलेगी।\n' +
    '• Purchase Return (P/R): एक्सपायर या डैमेज हो चुकी दवा को सप्लायर को वापस भेजते समय डेबिट नोट (Debit Note) काटा जाता है।'
  );

  // -------------------------------------------------------------
  // CHAPTER 2.4: ACCOUNTS PANEL (CRITICAL EMPHASIS)
  // -------------------------------------------------------------
  doc.addPage();
  addSectionHeader(
    '2.4 अकाउंट्स एवं बुक्स पैनल (Accounts & Books Panel) - संपूर्ण वित्तीय कार्यप्रणाली',
    'दवा दुकान के सारे हिसाब-किताब, वाउचर एंट्री, रोकड़ व बैंक बही, लेजर और बकाए का प्रबंधन'
  );

  tryAddImage('Accounts_6922e673.PNG', 220, 145);

  addSubHeader('1. Receipt Voucher (रसीद वाउचर)');
  addParagraph(
    'जब किसी मरीज या पार्टी से पिछला बकाया पैसा नकद या बैंक द्वारा प्राप्त होता है, तो Receipt Voucher बनाया जाता है:\n' +
    '• Date: भुगतान प्राप्ति की तारीख दर्ज करें।\n' +
    '• Account / Party: जिस मरीज या पार्टी ने पैसा दिया, उसका लेजर चुनें।\n' +
    '• Amount Received: प्राप्त की गई कुल राशि भरें।\n' +
    '• Payment Mode: Cash (गल्ला) या Bank A/c (चेक / यूपीआई ट्रांसफर)।\n' +
    '• Narration: संदर्भ टिप्पणी (उदा. "Being balance received against Bill #402").\n' +
    '• Save: सेव करते ही पार्टी के बकाए में से यह राशि तुरंत घट जाएगी।'
  );

  addSubHeader('2. Payment Voucher (भुगतान वाउचर)');
  addParagraph(
    'जब फार्मेसी किसी मेडिसिन डिस्ट्रीब्यूटर या सप्लायर को दवा खरीद का भुगतान करती है:\n' +
    '• Supplier Ledger: सप्लायर (उदा. Alkem Distributor, Sun Pharma Depot) का चयन करें।\n' +
    '• Amount Paid: चुकाई गई रकम भरें।\n' +
    '• Payment Source: Cash Drawer या Bank Account (Cheque No. / RTGS / UTR No.).\n' +
    '• सप्लायर का लेजर तुरंत अपडेट हो जाता है।'
  );

  addSubHeader('3. Cash & Bank Book (रोकड़ एवं बैंक बही)');
  tryAddImage('Book_1490277f.PNG', 220, 150);
  addParagraph(
    'दिनभर में दुकान में आए और गए एक-एक पैसे का संपूर्ण लेखा-जोखा:\n' +
    '• Opening Cash: सुबह दुकान खुलते समय गल्ले में रखी कुल राशि।\n' +
    '• Cash Inflow: दिनभर की नकद दवा बिक्री और रिकवरी से आया पैसा।\n' +
    '• Cash Outflow: दुकान के खर्चे, चाय-नाश्ता, स्टाफ खर्च या सप्लायर पेमेंट।\n' +
    '• Closing Cash: शाम को दुकान बंद करते समय गल्ले में मौजूद अंतिम वास्तविक राशि।\n' +
    '• Bank Balance: क्लीनिक के करंट/सेविंग्स खाते में कुल उपलब्ध जमा राशि।'
  );

  addSubHeader('4. Ledger A/c (खाता बही)');
  addParagraph(
    'किसी भी सप्लायर, मरीज या डॉक्टर का व्यक्तिगत खाता 1 सेकंड में खोलें। इसमें दिनांकवार डेबिट (Debit), क्रेडिट (Credit) और शेष बकाया (Balance) स्पष्ट दिखाई देता है। आप इसे 1-क्लिक में PDF या Excel में डाउनलोड कर सकते हैं।'
  );

  addSubHeader('5. Outstanding Statement (बकाया सूची)');
  addBulletList([
    'Payables (सप्लायर बकाया): किस-किस डिस्ट्रीब्यूटर का कितना बिल देना बाकी है, उनके बिल की देय तिथि (Due Date) के साथ।',
    'Receivables (ग्राहकों का बकाया): किन मरीजों या संस्थानों पर फार्मेसी का पैसा बाकी है।',
    'Aging Analysis: 0-30 दिन, 31-60 दिन और 90+ दिन पुराने बकाए का अलग-अलग रंग में वर्गीकरण ताकि रिकवरी समय पर हो सके।',
  ]);

  addSubHeader('6. Contra & Journal Voucher');
  addParagraph(
    '• Contra Voucher: जब गल्ले से कैश निकालकर बैंक में जमा किया जाए, या बैंक से कैश निकाला जाए।\n' +
    '• Journal Voucher: जब बिना नकद लेन-देन के दो खातों के बीच डिस्काउंट या राउंड-ऑफ एडजस्टमेंट करना हो।'
  );

  // -------------------------------------------------------------
  // CHAPTER 2.5: DIGITAL, GST, STOCKS & HOTKEYS
  // -------------------------------------------------------------
  doc.addPage();
  addSectionHeader('2.5 डिजिटल, जीएसटी, स्टॉक्स एवं हॉट कीज संपूर्ण मार्गदर्शिका');

  addSubHeader('1. Digital Panel (डिजिटल बिलिंग व क्यूआर कोड)');
  tryAddImage('Digital_2d0656f7.PNG', 210, 145);
  addParagraph(
    '• Dynamic UPI QR: बिल बनते ही स्क्रीन पर सटीक राशि का क्यूआर कोड बन जाता है। मरीज किसी भी यूपीआई ऐप से स्कैन कर सकता है।\n' +
    '• WhatsApp / SMS Invoice: बिल सेव होते ही मरीज के मोबाइल पर डिजिटल इनवॉइस का लिंक व्हाट्सएप पर भेजा जा सकता है।\n' +
    '• Multi-Counter Sync: अस्पताल में अगर 3 काउंटर हैं, तो तीनों काउंटरों का डेटा रीयल-टाइम में क्लाउड पर सिंक रहता है।'
  );

  addSubHeader('2. Stocks & Inventory (स्टॉक नियंत्रण)');
  tryAddImage('Stocks_2643524f.PNG', 220, 150);
  addBulletList([
    'Current Stock (ALT+S) व Filtered Stock: दवा का नाम, उपलब्ध स्ट्रिप्स/शीशियों की संख्या, बैच नंबर और एक्सपायरी डेट की लाइव सूची।',
    '90-Day Expiry Alert: 90 दिन में एक्सपायर होने वाली दवाओं के आगे पीला चेतावनी टैग लग जाता है।',
    'Expired Stock Block: एक्सपायर्ड दवा की बिलिंग सॉफ्टवेयर अपने आप रोक देता है।',
    'Re-Order Management: न्यूनतम सीमा से कम बची दवाओं की ऑटोमैटिक परचेज लिस्ट तैयार हो जाती है।',
  ]);

  addSubHeader('3. Gst, Final Reports & e-Way Bill');
  tryAddImage('Gst_7b03a7d7.PNG', 210, 150);
  addParagraph(
    '• GSTR-1: महीने भर में बेची गई दवाओं का B2B और B2C टैक्स विवरण।\n' +
    '• GSTR-2 / 2A-2B Reconciliation: डिस्ट्रीब्यूटरों द्वारा पोर्टल पर चढ़ाए गए बिलों का इनपुट टैक्स क्रेडिट (ITC) मिलान।\n' +
    '• E-Way Bill: ₹50,000 से अधिक के अंतरराज्यीय या अंतरजिला चालान के लिए ई-वे बिल जनरेशन।'
  );

  addSubHeader('4. दायां मेनू बार के 17 त्वरित बटन (Right Sidebar 17 Options)');
  const sidebarOpts = [
    '1. Sale: नया सेल बिल बनाएं (Alt+N)',
    '2. Purc. Challan: सप्लायर खरीद चालान दर्ज करें',
    '3. S/R Expiry: मरीज की एक्सपायर/वापस दवा लें',
    '4. P/R Expiry: सप्लायर को डैमेज माल वापस भेजें',
    '5. Receipt: मरीज/पार्टी से बकाया पैसा लें',
    '6. Payment: सप्लायर को बिल का भुगतान करें',
    '7. Cash & Bank Book: दिन का कुल नकद गल्ला देखें',
    '8. Ledger A/c: किसी भी खाते का स्टेटमेंट देखें',
    '9. Outstanding: कुल लेना/देना बकाया रिपोर्ट',
    '10. Stock Status: उपलब्ध दवाइयों की लाइव संख्या',
    '11. Stock & Sales Analysis: बिक्री गति व मार्जिन',
    '12. Re-Order: कम स्टॉक वाली दवाओं की आर्डर लिस्ट',
    '13. Sales Book: आज कटे सभी बिलों की क्रमवार सूची',
    '14. Dispatch Summary: दवा डिलीवरी व पैकिंग स्थिति',
    '15. Bill Taging: स्पेशल केस बिलों की टैगिंग',
    '16. Daily Analysis (MIS): आज की कुल बिक्री व लाभ',
    '17. Todays Gross Profit: आज का शुद्ध मार्जिन निकालें',
  ];
  doc.fontSize(8).fillColor(darkSlate).font(fontRegular);
  sidebarOpts.forEach((opt) => {
    doc.text(`• ${opt}`, { indent: 10, lineGap: 1.2 });
  });

  doc.moveDown(0.3);
  addSubHeader('5. मुख्य की-बोर्ड शॉर्टकट (Hot Keys Reference)');
  const hotKeys = [
    '• Alt + N : नया सेल बिल खोलें (New Sale Invoice)',
    '• Alt + P : पिछला बिल प्रिंट करें (Print Last Bill)',
    '• F1 : दवा स्टॉक व लेजर सर्च (Search Medicine / Ledger)',
    '• F2 : नया मास्टर आइटम / तारीख बदलना (Add Item / Date)',
    '• F8 : बिल में संशोधन करना (Modify Existing Bill)',
    '• F10 : बिल को फाइनल सेव व प्रिंट करना (Finalize & Save Bill)',
    '• Esc : डायलॉग बंद करना या डैशबोर्ड पर लौटना (Back / Close)',
  ];
  hotKeys.forEach((hk) => {
    doc.fontSize(8.5).fillColor(navyAccent).font(fontBold).text(hk, { indent: 10, lineGap: 1.2 });
  });

  // -------------------------------------------------------------
  // CHAPTER 3: DOCTOR OPD & PRESCRIPTION (PARCHI)
  // -------------------------------------------------------------
  doc.addPage();
  addSectionHeader(
    'अध्याय 3: डॉक्टर ओपीडी चैम्बर एवं डिजिटल पर्ची (Prescription & Parchi)',
    'लाइव मरीज कतार, डिजिटल पर्ची (Rx), हस्तलिखित पर्ची अपलोड व पूर्व इतिहास'
  );

  addParagraph(
    'डॉक्टर पैनल चिकित्सकों को उच्च गति से मरीज देखने, उनकी जांच व लक्षण दर्ज करने, खुराक व खाने के समय के साथ दवाइयां लिखने या हाथ से लिखी पर्ची का फोटो अपलोड करने की सुविधा देता है।'
  );

  tryAddImage('image_83608ee1.png', 500, 190);

  addSubHeader('3.1 डिजिटल पर्ची निर्माण के 5 मुख्य भाग (5 Core Prescription Blocks)');
  addBulletList([
    '1. Patient Info: मरीज का नाम, टोकन नंबर, लिंग, उम्र, वजन और संपर्क नंबर।',
    '2. Chief Complaints: मरीज की मुख्य समस्याएं (उदा. 3 दिन से तेज बुखार, खांसी, सीने में जकड़न)।',
    '3. Patient Vitals: रक्तचाप (BP - 120/80 mmHg), नाड़ी (Pulse - 76 bpm), तापमान (Temp - 101°F), वजन (Weight - 68 kg) एवं SpO2 (98%)।',
    '4. Prescribed Medicines (Rx): दवा का नाम, मात्रा, खुराक (1-0-1 सुबह-शाम), खाने का समय (खाना खाने के बाद / खाली पेट) और अवधि (5 दिन)।',
    '5. Doctor Advice & Tests: पैथोलॉजी जांच निर्देश (उदा. CBC, Widal Test) और फॉलो-अप तारीख।',
  ]);

  addSubHeader('3.2 हस्तलिखित पर्ची अपलोड (Handwritten Parchi Upload)');
  addParagraph(
    'यदि डॉक्टर कंप्यूटर टाइपिंग की जगह अपने पैड पर पेन से लिखना पसंद करते हैं:\n' +
    '1. पर्ची मोडल में "Camera / Upload Parchi" बटन पर क्लिक करें।\n' +
    '2. मोबाइल कैमरा या वेबकैम से हाथ से लिखी पर्ची का स्पष्ट फोटो खींचे।\n' +
    '3. फोटो तुरंत कंप्रेस होकर मरीज के रिकॉर्ड में सुरक्षित हो जाती है। मरीज व फार्मेसी दोनों इसे तुरंत देख और प्रिंट कर सकते हैं।'
  );

  addSubHeader('3.3 पूर्व इतिहास एवं दवा सुरक्षा (Medical History)');
  addParagraph(
    'मरीज का मोबाइल नंबर डालते ही उसकी पिछली सभी विज़िट्स, पुरानी पर्चियां और एलर्जी इतिहास एक स्क्रीन पर खुल जाता है, जिससे दवाओं का दोहराव नहीं होता।'
  );

  // -------------------------------------------------------------
  // CHAPTER 4: RECEPTION & OPD TOKENS
  // -------------------------------------------------------------
  doc.addPage();
  addSectionHeader(
    'अध्याय 4: रिसेप्शन डेस्क एवं टोकन प्रबंधन (Reception Desk SOP)',
    'मरीज पंजीकरण, डॉक्टर स्लॉट बुकिंग, कतार टोकन प्रिंटिंग व फीस कलेक्शन'
  );

  addParagraph(
    'रिसेप्शन अस्पताल का मुख्य प्रवेश द्वार है। यहां आने वाले हर मरीज का रिकॉर्ड दर्ज होता है और टोकन पर्ची जारी की जाती है।'
  );

  addSubHeader('4.1 वॉक-इन मरीज पंजीकरण (Walk-In Patient Registration)');
  addBulletList([
    'चरण 1: रिसेप्शन पैनल में "+ New Appointment" या F2 दबाएं।',
    'चरण 2: मरीज का मोबाइल नंबर दर्ज करें। यदि पुराना मरीज है तो उसका नाम व पता स्वतः लोड हो जाएगा।',
    'चरण 3: मरीज की आयु, लिंग और लक्षण दर्ज करें।',
    'चरण 4: संबंधित विशेषज्ञ डॉक्टर का चयन करें।',
    'चरण 5: परामर्श शुल्क (Consultation Fee - उदा. ₹300) नकद या यूपीआई से प्राप्त करें।',
    'चरण 6: "Print Token Slip" दबाएं। थर्मल प्रिंटर पर मरीज की पर्ची व टोकन नंबर प्रिंट हो जाएगा।',
  ]);

  addSubHeader('4.2 स्लॉट क्लैश रोकथाम (Double-Booking Guard)');
  addParagraph(
    'सिस्टम एक समय पर एक ही डॉक्टर के स्लॉट में दो मरीजों को बुक होने से स्वतः रोकता है। यदि कोई स्लॉट पहले से आरक्षित है, तो सिस्टम रिसेप्शनिस्ट को तुरंत चेतावनी देकर अगला उपलब्ध समय सुझाता है।'
  );

  // -------------------------------------------------------------
  // CHAPTER 5: SUPER ADMIN ERP DASHBOARD
  // -------------------------------------------------------------
  doc.addPage();
  addSectionHeader(
    'अध्याय 5: सुपर एडमिन ईआरपी एवं डेटाबेस सुरक्षा (Admin Dashboard & Backup)',
    'समस्त अस्पताल की निगरानी, स्टाफ आरबीएसी, ऑटो बैकअप व ऑडिट ट्रेल्स'
  );

  addSubHeader('5.1 स्टाफ प्रबंधन एवं सुरक्षा अनुमतियां (Staff RBAC)');
  addParagraph(
    'एडमिन किसी भी समय नए डॉक्टरों, फार्मासिस्टों और रिसेप्शनिस्टों के खाते बना सकते हैं, पासवर्ड रीसेट कर सकते हैं या उनकी अनुमतियों को नियंत्रित कर सकते हैं।'
  );

  addSubHeader('5.2 दैनिक स्वचालित मध्यरात्रि बैकअप (Automated Midnight Backup)');
  addParagraph(
    'हर रात 00:00:00 (मध्यरात्रि) पर सर्वर अपने आप पूरे डेटाबेस का नया स्नैपशॉट तैयार करता है।\n' +
    '• SQL Dump (.sql): रिलेशनल डेटाबेस का संपूर्ण स्ट्रक्चर व डेटा।\n' +
    '• JSON Backup (.json): दस्तावेजों का क्लाउड-कॉम्पैटिबल बैकअप।\n' +
    'एडमिन कभी भी /admin/backup पर जाकर इन फाइलों को अपनी पेन ड्राइव या कंप्यूटर पर डाउनलोड कर सकते हैं।'
  );

  addSubHeader('5.3 स्टाफ एक्टिविटी ऑडिट लॉग (/admin/activity)');
  addParagraph(
    'अस्पताल में काटा गया हर एक बिल, बनाई गई हर पर्ची और हटाया गया कोई भी रिकॉर्ड समय, तारीख और ऑपरेटर के नाम के साथ दर्ज होता है ताकि कभी कोई हेराफेरी न हो सके।'
  );

  // -------------------------------------------------------------
  // CHAPTER 6: TROUBLESHOOTING & EMERGENCY SOPS
  // -------------------------------------------------------------
  doc.addPage();
  addSectionHeader(
    'अध्याय 6: समस्या निवारण, अक्सर पूछे जाने वाले सवाल एवं आपातकालीन संपर्क',
    'दैनिक संचालन के दौरान आने वाली समस्याओं का त्वरित समाधान'
  );

  const faqs = [
    {
      q: 'प्र 1: यदि इंटरनेट बंद या धीमा हो जाए तो क्या करें?',
      a: 'सिस्टम में लोकल ऑफलाइन कैशिंग सक्रिय है। आप मरीज की एंट्री और दवा बिलिंग जारी रख सकते हैं। इंटरनेट आते ही सारा डेटा अपने आप क्लाउड पर सिंक हो जाएगा।',
    },
    {
      q: 'प्र 2: बिलिंग के समय अगर कोई दवा स्टॉक में न दिखे तो?',
      a: 'फार्मेसी में F2 दबाकर त्वरित आइटम मास्टर खोलें, या थोक सप्लायर का एक्सेल बिल "Upload Excel" से लोड करें। नया बैच जुड़ते ही दवा बिलिंग में दिखने लगेगी।',
    },
    {
      q: 'प्र 3: मरीज की पुरानी पर्ची या बिल दोबारा कैसे प्रिंट करें?',
      a: 'फार्मेसी में "Invoices" टैब में जाएं या रिसेप्शन/डॉक्टर पैनल में मरीज का मोबाइल नंबर डालें। 1 सेकंड में पुरानी पर्ची खुल जाएगी और आप "Reprint" कर सकेंगे।',
    },
    {
      q: 'प्र 4: पूरे डेटा का बैकअप अपनी पेन ड्राइव में कैसे लें?',
      a: 'एडमिन पैनल में लॉगिन करें, "Backup & Restore" मेनू में जाएं और "Download SQL Database Dump (.sql)" पर क्लिक करें। फाइल आपके कंप्यूटर पर डाउनलोड हो जाएगी।',
    },
  ];

  faqs.forEach((faq) => {
    doc.fontSize(9.5).fillColor(emeraldColor).font(fontBold).text(faq.q);
    doc.moveDown(0.15);
    doc.fontSize(8.5).fillColor(darkSlate).font(fontRegular).text(faq.a, { lineGap: 1.5 });
    doc.moveDown(0.6);
  });

  doc.moveDown(0.6);
  doc.rect(36, doc.y, 523, 65).fill('#F1F5F9');
  doc
    .fontSize(9.5)
    .fillColor(primaryColor)
    .font(fontBold)
    .text('तकनीकी सहायता एवं आपातकालीन संपर्क (Helpdesk & Support):', 50, doc.y - 55);
  doc
    .fontSize(8.5)
    .fillColor(darkSlate)
    .font(fontRegular)
    .text(
      'संदाना क्लीनिक एवं डुड्रक्स फार्मेसी केंद्रीय नियंत्रण कक्ष\n' +
      'अधिकृत एडमिन ईमेल: kyp04010016@gmail.com · दूरभाष / WhatsApp: +91 98400 11224\n' +
      'सिस्टम आर्किटेक्चर: React 19 + TypeScript + Vite + Node.js Express + Firebase Cloud Firestore + Marg ERP 9+ Engine',
      50,
      doc.y + 4
    );

  doc.end();
}
