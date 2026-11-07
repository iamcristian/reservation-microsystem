import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting seed...");

  await prisma.notification.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.timeOff.deleteMany();
  await prisma.workingShift.deleteMany();
  await prisma.staffService.deleteMany();
  await prisma.service.deleteMany();
  await prisma.staffProfile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.businessSettings.deleteMany();

  // 1. Business Settings
  await prisma.businessSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: "Clínica Dental & Estética Sonrisa",
      tagline: "Atención odontológica y estética de primer nivel",
      logoUrl: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=150&auto=format&fit=crop&q=80",
      addressText: "Av. Simón López esq. Av. Beijing, Cochabamba, Bolivia",
      googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=-17.3713,-66.1742",
      phoneWhatsapp: "+52 55 1234 5678",
      currencySymbol: "$",
      staffLabel: "Doctor(a)",
      slotStepMin: 30,
      bookingHorizonDays: 7,
      minLeadTimeMinutes: 30,
      maxActiveBookings: 2,
      minCancelNoticeHours: 6,
      themePrimaryHex: "#1F1F23",
      themeSurfaceHex: "#9FA0A6",
    },
  });

  // 2. Users (Admin, Staff, Customers)
  const defaultAdminPassword = await bcrypt.hash("Admin123!", 10);
  const defaultStaffPassword = await bcrypt.hash("Doctor123!", 10);
  const defaultCustomerPassword = await bcrypt.hash("Cliente123!", 10);

  const userAdmin = await prisma.user.upsert({
    where: { email: "alejandro@sonrisa.com" },
    update: {
      passwordHash: defaultAdminPassword,
    },
    create: {
      email: "alejandro@sonrisa.com",
      passwordHash: defaultAdminPassword,
      googleId: "google_admin_alejandro",
      name: "Dr. Alejandro Vega",
      phone: "+52 55 1111 2222",
      role: "ADMIN",
      avatarUrl: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150&auto=format&fit=crop&q=80",
    },
  });

  const userSofia = await prisma.user.upsert({
    where: { email: "sofia@sonrisa.com" },
    update: {
      passwordHash: defaultStaffPassword,
    },
    create: {
      email: "sofia@sonrisa.com",
      passwordHash: defaultStaffPassword,
      googleId: "google_sofia_rios",
      name: "Dra. Sofía Ríos",
      phone: "+52 55 3333 4444",
      role: "PROVIDER",
      avatarUrl: "https://images.unsplash.com/photo-1594824813583-e072f44c4e78?w=150&auto=format&fit=crop&q=80",
    },
  });

  const userMarcos = await prisma.user.upsert({
    where: { email: "marcos@sonrisa.com" },
    update: {
      passwordHash: defaultStaffPassword,
    },
    create: {
      email: "marcos@sonrisa.com",
      passwordHash: defaultStaffPassword,
      googleId: "google_marcos_paz",
      name: "Dr. Marcos Paz",
      phone: "+52 55 5555 6666",
      role: "PROVIDER",
      avatarUrl: "https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=150&auto=format&fit=crop&q=80",
    },
  });

  const customerCarlos = await prisma.user.upsert({
    where: { email: "carlos.cliente@gmail.com" },
    update: {
      passwordHash: defaultCustomerPassword,
    },
    create: {
      email: "carlos.cliente@gmail.com",
      passwordHash: defaultCustomerPassword,
      googleId: "google_carlos_mendoza",
      name: "Carlos Mendoza",
      phone: "+52 55 8888 9999",
      role: "CUSTOMER",
      completedCount: 3,
      noShowCount: 0,
    },
  });

  const customerLucia = await prisma.user.upsert({
    where: { email: "lucia.valdez@gmail.com" },
    update: {
      passwordHash: defaultCustomerPassword,
    },
    create: {
      email: "lucia.valdez@gmail.com",
      passwordHash: defaultCustomerPassword,
      googleId: "google_lucia_valdez",
      name: "Lucía Valdez",
      phone: "+52 55 7777 8888",
      role: "CUSTOMER",
      completedCount: 1,
      noShowCount: 0,
    },
  });

  // 3. Staff Profiles
  const staffAlejandro = await prisma.staffProfile.upsert({
    where: { userId: userAdmin.id },
    update: {},
    create: {
      userId: userAdmin.id,
      displayName: "Dr. Alejandro Vega",
      specialtyTitle: "Odontología Integral & Cirugía",
      avatarUrl: userAdmin.avatarUrl,
      customHorizonDays: 7,
      customLeadTimeMin: 30,
      sortOrder: 1,
    },
  });

  const staffSofia = await prisma.staffProfile.upsert({
    where: { userId: userSofia.id },
    update: {},
    create: {
      userId: userSofia.id,
      displayName: "Dra. Sofía Ríos",
      specialtyTitle: "Ortodoncia & Diseño de Sonrisa",
      avatarUrl: userSofia.avatarUrl,
      customHorizonDays: 7,
      customLeadTimeMin: 30,
      sortOrder: 2,
    },
  });

  const staffMarcos = await prisma.staffProfile.upsert({
    where: { userId: userMarcos.id },
    update: {},
    create: {
      userId: userMarcos.id,
      displayName: "Dr. Marcos Paz",
      specialtyTitle: "Endodoncia & Urgencias 24h",
      avatarUrl: userMarcos.avatarUrl,
      customHorizonDays: 7,
      customLeadTimeMin: 15, // Permite agendar con 15 min de margen
      sortOrder: 3,
    },
  });

  // 4. Services
  const s1 = await prisma.service.create({
    data: {
      name: "Limpieza Dental & Profilaxis",
      description: "Eliminación de sarro por ultrasonido y pulido dental completo.",
      durationMin: 30,
      bufferAfterMin: 0,
      price: 35.0,
      sortOrder: 1,
    },
  });

  const s2 = await prisma.service.create({
    data: {
      name: "Consulta & Diagnóstico General",
      description: "Valoración clínica completa con cámara intraoral y plan de tratamiento.",
      durationMin: 30,
      bufferAfterMin: 0,
      price: 25.0,
      sortOrder: 2,
    },
  });

  const s3 = await prisma.service.create({
    data: {
      name: "Ajuste de Ortodoncia / Brackets",
      description: "Control mensual de ortodoncia, cambio de arcos y ligas.",
      durationMin: 45,
      bufferAfterMin: 0,
      price: 50.0,
      sortOrder: 3,
    },
  });

  const s4 = await prisma.service.create({
    data: {
      name: "Blanqueamiento Led Avanzado",
      description: "Aclaramiento dental en una sola sesión de 60 minutos con lámpara LED.",
      durationMin: 60,
      bufferAfterMin: 0,
      price: 120.0,
      sortOrder: 4,
    },
  });

  // 5. Connect Staff to Services
  // Alejandro does s1, s2
  await prisma.staffService.createMany({
    data: [
      { staffId: staffAlejandro.id, serviceId: s1.id },
      { staffId: staffAlejandro.id, serviceId: s2.id },
      { staffId: staffAlejandro.id, serviceId: s4.id },
      // Sofia does s1, s2, s3, s4
      { staffId: staffSofia.id, serviceId: s1.id },
      { staffId: staffSofia.id, serviceId: s2.id },
      { staffId: staffSofia.id, serviceId: s3.id },
      { staffId: staffSofia.id, serviceId: s4.id },
      // Marcos does s1, s2
      { staffId: staffMarcos.id, serviceId: s1.id },
      { staffId: staffMarcos.id, serviceId: s2.id },
    ],
  });

  // 6. Working Shifts
  // Day of week: 0=Dom, 1=Lun, 2=Mar, 3=Mie, 4=Jue, 5=Vie, 6=Sab
  await prisma.workingShift.createMany({
    data: [
      // Dr. Alejandro
      { staffId: staffAlejandro.id, dayOfWeek: 1, startTime: "08:30", endTime: "13:00" }, // Lunes mañana
      { staffId: staffAlejandro.id, dayOfWeek: 2, startTime: "14:00", endTime: "19:30" }, // Martes tarde
      { staffId: staffAlejandro.id, dayOfWeek: 3, startTime: "09:00", endTime: "13:00" }, // Miércoles turno 1
      { staffId: staffAlejandro.id, dayOfWeek: 3, startTime: "15:00", endTime: "19:00" }, // Miércoles turno 2
      { staffId: staffAlejandro.id, dayOfWeek: 4, startTime: "09:00", endTime: "17:00" }, // Jueves
      { staffId: staffAlejandro.id, dayOfWeek: 5, startTime: "09:00", endTime: "16:00" }, // Viernes
      { staffId: staffAlejandro.id, dayOfWeek: 6, startTime: "09:00", endTime: "13:00" }, // Sábado mediodía

      // Dra. Sofía
      { staffId: staffSofia.id, dayOfWeek: 1, startTime: "10:00", endTime: "18:00" },
      { staffId: staffSofia.id, dayOfWeek: 2, startTime: "10:00", endTime: "18:00" },
      { staffId: staffSofia.id, dayOfWeek: 3, startTime: "10:00", endTime: "18:00" },
      { staffId: staffSofia.id, dayOfWeek: 4, startTime: "10:00", endTime: "18:00" },
      { staffId: staffSofia.id, dayOfWeek: 5, startTime: "10:00", endTime: "18:00" },
      { staffId: staffSofia.id, dayOfWeek: 6, startTime: "10:00", endTime: "14:00" },

      // Dr. Marcos (Urgencias / Madrugadas)
      { staffId: staffMarcos.id, dayOfWeek: 1, startTime: "15:00", endTime: "22:00" },
      { staffId: staffMarcos.id, dayOfWeek: 2, startTime: "15:00", endTime: "22:00" },
      { staffId: staffMarcos.id, dayOfWeek: 4, startTime: "15:00", endTime: "22:00" },
      { staffId: staffMarcos.id, dayOfWeek: 5, startTime: "20:00", endTime: "23:59" },
      { staffId: staffMarcos.id, dayOfWeek: 6, startTime: "00:00", endTime: "04:00" }, // Madrugada
    ],
  });

  // 7. Sample Upcoming Appointment for Carlos
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);

  const tomorrowEnd = new Date(tomorrow);
  tomorrowEnd.setMinutes(tomorrowEnd.getMinutes() + 40); // 30 min + 10 buffer

  const apt = await prisma.appointment.create({
    data: {
      customerId: customerCarlos.id,
      staffId: staffAlejandro.id,
      serviceId: s1.id,
      startAt: tomorrow,
      endAt: tomorrowEnd,
      status: "CONFIRMED",
      priceSnapshot: 35.0,
      customerNotes: "Sensibilidad en encías inferiores",
    },
  });

  console.log("✅ Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
