export async function seedHalaqatData(db: any) {
  console.log('🌱 جاري بدء تهيئة قاعدة البيانات (Seed)...');

  // --- Helpers ---
  const generateId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
  const randomElement = (arr: any[]) => arr[Math.floor(Math.random() * arr.length)];

  // 🚀 Helper to generate uniform schedule dates for a circle
  // 0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday
  const generateScheduleDates = (start: Date, end: Date, meetingDays: number[]) => {
    const dates = [];
    let current = new Date(start.getTime());
    while (current <= end) {
      if (meetingDays.includes(current.getDay())) {
        dates.push(current.toISOString().split('T')[0]);
      }
      current.setDate(current.getDate() + 1);
    }
    return dates;
  };

  // 🚀 Bulk Insert Helper
  const bulkInsert = async (tableName: string, columns: string[], rows: any[][]) => {
    if (rows.length === 0) return;
    const chunkSize = 50; 
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const placeholders = chunk.map(() => `(${columns.map(() => '?').join(', ')})`).join(', ');
      
      const flatValues = chunk.reduce((acc, curr) => acc.concat(curr), []);
      
      await db.run(`INSERT INTO ${tableName} (${columns.join(', ')}) VALUES ${placeholders}`, flatValues);
    }
  };

  // Arabic Names and Data
  const firstNamesMale = ['محمد', 'أحمد', 'يوسف', 'عمر', 'علي', 'إبراهيم', 'حمزة', 'طارق', 'بلال', 'زيد', 'أيوب', 'ياسين'];
  const firstNamesFemale = ['فاطمة', 'خديجة', 'عائشة', 'زينب', 'مريم', 'حفصة', 'رقية', 'أسماء', 'سلمى', 'صفية'];
  const lastNames = ['الفاسي', 'بن علي', 'العمراني', 'الإدريسي', 'المنصوري', 'برادة', 'الشرايبي', 'التازي', 'القباج', 'لحلو', 'بناني'];
  
  const grades = ['Excellent', 'Very Good', 'Good', 'Needs Work', 'Repeat'];


  const remarks = ['ما شاء الله', 'يحتاج إلى مراجعة أحكام التجويد هنا', 'حفظ متقن', 'تردد في بعض الآيات المتشابهة', 'مجهود طيب'];

  try {
    console.log('📦 جاري تجميع البيانات في الذاكرة...');
    
    const teachersData: any[][] = [];
    const circlesData: any[][] = [];
    const studentsData: any[][] = [];
    const homeworksData: any[][] = [];
    const progressData: any[][] = [];

    // --- 1. Generate Teachers ---
    const teachers = [
      { id: generateId(), name: 'الشيخ محمود بن علي', is_owner: 1, contact_info: '0600000001' },
      { id: generateId(), name: 'الأستاذة فاطمة العمراني', is_owner: 0, contact_info: '0600000002' }
    ];
    for (const t of teachers) teachersData.push([t.id, t.name, t.is_owner, t.contact_info]);

    // --- 2. Generate Circles with specific meeting days ---
    const startDate = new Date(2025, 8, 1);
    const today = new Date();

    const circles = [
      // Meets Mon, Wed, Fri
      { id: generateId(), teacher_id: teachers[0].id, name: 'حلقة الفجر للتحفيظ', type: 'كبار', scheduleDays: [1, 3, 5] },
      // Meets Tue, Thu
      { id: generateId(), teacher_id: teachers[1].id, name: 'حلقة النور للأطفال', type: 'أطفال', scheduleDays: [2, 4] },
      // Meets Sat, Sun (Weekend)
      { id: generateId(), teacher_id: teachers[0].id, name: 'حلقة الهدى المكثفة', type: 'يافعين', scheduleDays: [0, 6] }
    ];

    for (const c of circles) {
      circlesData.push([c.id, c.teacher_id, c.name, c.type, startDate.toISOString().split('T')[0]]);
    }

    // --- 3. Generate Students, Homeworks, and Progress ---
    for (const circle of circles) {
      // Generate the master list of uniform dates for this specific circle
      const circleMeetingDates = generateScheduleDates(startDate, today, circle.scheduleDays);

      for (let i = 0; i < 20; i++) {
        const isMale = Math.random() > 0.5;
        const firstName = randomElement(isMale ? firstNamesMale : firstNamesFemale);
        const lastName = randomElement(lastNames);
        
        const studentId = generateId();
        const enlistmentDateObj = new Date(startDate.getTime() + Math.random() * (new Date(2026, 0, 1).getTime() - startDate.getTime()));
        const enlistment_date = enlistmentDateObj.toISOString().split('T')[0];
        
        studentsData.push([
          studentId, circle.id, `${firstName} ${lastName}`, isMale ? 'Male' : 'Female', 
          enlistment_date, Math.random() > 0.3 ? `أبو ${firstName} ${lastName}` : null, 
          '06' + randomInt(10000000, 99999999), Math.random() > 0.9 ? 'حساسية من الفول السوداني' : null
        ]);

        // Filter circle dates to only include meeting days AFTER the student joined
        const validDatesForStudent = circleMeetingDates.filter(d => d >= enlistment_date);
        
        // 🚀 Loop through EVERY uniform date for this student
        for (const uniformDate of validDatesForStudent) {
          // 15% chance the student was absent on this specific day
          const isAbsent = Math.random() < 0.15; 

          const startSurah = randomInt(78, 114);
          const mistakes = isAbsent ? 0 : (Math.random() > 0.6 ? randomInt(1, 4) : 0); 
          
          let finalGradeMark = '';
          if (isAbsent) {
            finalGradeMark = 'Absent'; // Mark as absent
          } else {
            finalGradeMark = mistakes === 0 ? 'Excellent' : randomElement(grades); // Give normal grade
          }

          homeworksData.push([
            generateId(), studentId, circle.id, 
            uniformDate, // assigned_date is the uniform class date
            startSurah, randomInt(1, 5), startSurah, randomInt(1, 5) + randomInt(3, 10), mistakes,
            finalGradeMark, // Grade or 'Absent'
            isAbsent ? null : randomElement(remarks), // No remark if absent
            uniformDate // graded_date is EXACTLY the same uniform class date
          ]);
        }

        // Generate Mushaf Progress (Assigning them to random valid class dates)
        const progressRecords = randomInt(2, 6);
        const usedCombos = new Set();
        for (let p = 0; p < progressRecords; p++) {
          const hizb = randomElement([59, 60]);
          const thumun = randomInt(1, 8);
          const comboKey = `${hizb}-${thumun}`;
          
          if (!usedCombos.has(comboKey)) {
            usedCombos.add(comboKey);
            // Assign progress reviews to random uniform dates the student was present
            const randomUniformDate = validDatesForStudent.length > 0 
              ? randomElement(validDatesForStudent) 
              : enlistment_date;
            
            progressData.push([
              generateId(), studentId, hizb, thumun, randomInt(1, 5),
              (Math.random() * (4.0 - 2.5) + 2.5).toFixed(1),
              randomUniformDate, 
              Math.random() > 0.8 ? 1 : 0
            ]);
          }
        }
      }
    }

    // 🛑 Execute all database operations at the very end
    console.log('🚀 جاري إرسال البيانات إلى قاعدة البيانات...');
    await db.run(`BEGIN TRANSACTION;`); 

    await bulkInsert('teachers', ['id', 'name', 'is_owner', 'contact_info'], teachersData);
    await bulkInsert('circles', ['id', 'teacher_id', 'name', 'type', 'creation_date'], circlesData);
    await bulkInsert('students', ['id', 'circle_id', 'name', 'gender', 'enlistment_date', 'parent_name', 'parent_contact', 'medical_issues'], studentsData);
    await bulkInsert('homeworks', ['id', 'student_id', 'circle_id', 'date_assigned', 'start_surah', 'start_ayah', 'end_surah', 'end_ayah', 'mistakes_count', 'grade_mark', 'remark', 'graded_date'], homeworksData);
    await bulkInsert('student_mushaf_progress', ['id', 'student_id', 'hizb_number', 'thumun_number', 'review_count', 'average_score', 'last_graded_date', 'is_pre_memorized'], progressData);

    await db.run(`COMMIT;`);
    console.log(`✅ تمت التهيئة بنجاح! تم حفظ ${studentsData.length} طالب و ${homeworksData.length} واجب.`);

  } catch (error) {
    await db.run(`ROLLBACK;`);
    console.error('❌ فشلت التهيئة. جاري التراجع عن تغييرات قاعدة البيانات.', error);
    throw error;
  }
}