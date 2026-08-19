IF DB_ID(N'TheVocal_KruAir') IS NULL
BEGIN
    CREATE DATABASE TheVocal_KruAir;
END
GO

USE TheVocal_KruAir;
GO

IF OBJECT_ID(N'dbo.notifications', N'U') IS NULL
    CREATE TABLE dbo.notifications (
        id INT IDENTITY(1, 1) NOT NULL PRIMARY KEY,
        public_id NVARCHAR(40) NOT NULL UNIQUE,
        user_id INT NOT NULL,
        title NVARCHAR(150) NOT NULL,
        body NVARCHAR(MAX) NOT NULL,
        tone NVARCHAR(20) NOT NULL CONSTRAINT DF_notifications_tone DEFAULT N'blue',
        is_read BIT NOT NULL CONSTRAINT DF_notifications_read DEFAULT 0,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_notifications_created DEFAULT SYSUTCDATETIME()
    );
GO

IF OBJECT_ID(N'dbo.move_requests', N'U') IS NULL
    CREATE TABLE dbo.move_requests (
        id INT IDENTITY(1, 1) NOT NULL PRIMARY KEY,
        public_id NVARCHAR(40) NOT NULL UNIQUE,
        booking_id INT NOT NULL,
        user_id INT NOT NULL,
        requested_slot_id INT NOT NULL,
        from_text NVARCHAR(80) NOT NULL,
        to_text NVARCHAR(80) NOT NULL,
        status NVARCHAR(20) NOT NULL CONSTRAINT DF_move_requests_status DEFAULT N'pending',
        decided_by INT NULL,
        decided_at DATETIME2 NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_move_requests_created DEFAULT SYSUTCDATETIME()
    );
GO

IF OBJECT_ID(N'dbo.class_logs', N'U') IS NULL
    CREATE TABLE dbo.class_logs (
        id INT IDENTITY(1, 1) NOT NULL PRIMARY KEY,
        booking_id INT NOT NULL,
        user_id INT NOT NULL,
        lesson_title NVARCHAR(150) NOT NULL,
        note NVARCHAR(MAX) NULL,
        hours_deducted INT NOT NULL CONSTRAINT DF_class_logs_hours DEFAULT 1,
        outcome NVARCHAR(20) NOT NULL CONSTRAINT DF_class_logs_outcome DEFAULT N'done',
        created_at DATETIME2 NOT NULL CONSTRAINT DF_class_logs_created DEFAULT SYSUTCDATETIME()
    );
GO

IF OBJECT_ID(N'dbo.bookings', N'U') IS NULL
    CREATE TABLE dbo.bookings (
        id INT IDENTITY(1, 1) NOT NULL PRIMARY KEY,
        public_id NVARCHAR(40) NOT NULL UNIQUE,
        user_id INT NOT NULL,
        slot_id INT NOT NULL UNIQUE,
        user_package_id INT NULL,
        status NVARCHAR(20) NOT NULL CONSTRAINT DF_bookings_status DEFAULT N'pending',
        topic NVARCHAR(150) NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_bookings_created DEFAULT SYSUTCDATETIME(),
        confirmed_at DATETIME2 NULL
    );
GO

IF OBJECT_ID(N'dbo.teacher_availability', N'U') IS NULL
    CREATE TABLE dbo.teacher_availability (
        id INT IDENTITY(1, 1) NOT NULL PRIMARY KEY,
        teacher_id INT NOT NULL,
        slot_date DATE NOT NULL,
        slot_time TIME NOT NULL,
        duration_min INT NOT NULL CONSTRAINT DF_slots_duration DEFAULT 60,
        status NVARCHAR(20) NOT NULL CONSTRAINT DF_slots_status DEFAULT N'open',
        CONSTRAINT UQ_teacher_slot UNIQUE (teacher_id, slot_date, slot_time)
    );
GO

IF OBJECT_ID(N'dbo.voucher_usages', N'U') IS NULL
    CREATE TABLE dbo.voucher_usages (
        id INT IDENTITY(1, 1) NOT NULL PRIMARY KEY,
        voucher_id INT NOT NULL,
        transaction_id INT NOT NULL,
        used_at DATETIME2 NOT NULL CONSTRAINT DF_voucher_usages_used DEFAULT SYSUTCDATETIME()
    );
GO

IF OBJECT_ID(N'dbo.transactions', N'U') IS NULL
    CREATE TABLE dbo.transactions (
        id INT IDENTITY(1, 1) NOT NULL PRIMARY KEY,
        ref_no NVARCHAR(30) NOT NULL UNIQUE,
        user_id INT NOT NULL,
        package_id NVARCHAR(20) NOT NULL,
        gross_amount DECIMAL(12, 2) NOT NULL,
        discount_amount DECIMAL(12, 2) NOT NULL CONSTRAINT DF_tx_discount DEFAULT 0,
        net_amount DECIMAL(12, 2) NOT NULL,
        voucher_code NVARCHAR(30) NULL,
        method NVARCHAR(80) NOT NULL,
        status NVARCHAR(20) NOT NULL CONSTRAINT DF_tx_status DEFAULT N'success',
        created_at DATETIME2 NOT NULL CONSTRAINT DF_tx_created DEFAULT SYSUTCDATETIME(),
        paid_at DATETIME2 NULL
    );
GO

IF OBJECT_ID(N'dbo.vouchers', N'U') IS NULL
    CREATE TABLE dbo.vouchers (
        id INT IDENTITY(1, 1) NOT NULL PRIMARY KEY,
        code NVARCHAR(30) NOT NULL UNIQUE,
        type NVARCHAR(20) NOT NULL,
        value DECIMAL(12, 2) NOT NULL,
        max_discount DECIMAL(12, 2) NULL,
        valid_to DATETIME2 NULL,
        max_uses INT NULL,
        used_count INT NOT NULL CONSTRAINT DF_vouchers_used DEFAULT 0,
        is_active BIT NOT NULL CONSTRAINT DF_vouchers_active DEFAULT 1
    );
GO

IF OBJECT_ID(N'dbo.user_packages', N'U') IS NULL
    CREATE TABLE dbo.user_packages (
        id INT IDENTITY(1, 1) NOT NULL PRIMARY KEY,
        user_id INT NOT NULL,
        package_id NVARCHAR(20) NOT NULL,
        hours_total INT NOT NULL,
        hours_used INT NOT NULL CONSTRAINT DF_up_used DEFAULT 0,
        expires_at DATETIME2 NOT NULL,
        status NVARCHAR(20) NOT NULL CONSTRAINT DF_up_status DEFAULT N'active',
        transaction_id INT NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_up_created DEFAULT SYSUTCDATETIME()
    );
GO

IF OBJECT_ID(N'dbo.packages', N'U') IS NULL
    CREATE TABLE dbo.packages (
        id NVARCHAR(20) NOT NULL PRIMARY KEY,
        name NVARCHAR(80) NOT NULL,
        hours INT NOT NULL,
        price DECIMAL(12, 2) NOT NULL,
        note NVARCHAR(300) NULL,
        tag NVARCHAR(50) NULL,
        tone NVARCHAR(20) NULL,
        is_active BIT NOT NULL CONSTRAINT DF_packages_active DEFAULT 1
    );
GO

IF OBJECT_ID(N'dbo.users', N'U') IS NULL
    CREATE TABLE dbo.users (
        id INT IDENTITY(1, 1) NOT NULL PRIMARY KEY,
        public_id NVARCHAR(40) NOT NULL UNIQUE,
        role NVARCHAR(20) NOT NULL,
        email NVARCHAR(255) NOT NULL UNIQUE,
        phone NVARCHAR(20) NULL,
        password_hash NVARCHAR(255) NOT NULL,
        name NVARCHAR(100) NOT NULL,
        nickname NVARCHAR(50) NOT NULL,
        age INT NULL,
        education NVARCHAR(100) NULL,
        genres NVARCHAR(MAX) NULL,
        reason NVARCHAR(MAX) NULL,
        status NVARCHAR(20) NOT NULL CONSTRAINT DF_users_status DEFAULT N'active',
        line_linked BIT NOT NULL CONSTRAINT DF_users_line DEFAULT 0,
        consent_pdpa_at DATETIME2 NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_users_created DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NOT NULL CONSTRAINT DF_users_updated DEFAULT SYSUTCDATETIME()
    );
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_user_packages_user')
    ALTER TABLE dbo.user_packages ADD CONSTRAINT FK_user_packages_user FOREIGN KEY (user_id) REFERENCES dbo.users (id);
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_user_packages_package')
    ALTER TABLE dbo.user_packages ADD CONSTRAINT FK_user_packages_package FOREIGN KEY (package_id) REFERENCES dbo.packages (id);
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_transactions_user')
    ALTER TABLE dbo.transactions ADD CONSTRAINT FK_transactions_user FOREIGN KEY (user_id) REFERENCES dbo.users (id);
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_transactions_package')
    ALTER TABLE dbo.transactions ADD CONSTRAINT FK_transactions_package FOREIGN KEY (package_id) REFERENCES dbo.packages (id);
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_voucher_usages_voucher')
    ALTER TABLE dbo.voucher_usages ADD CONSTRAINT FK_voucher_usages_voucher FOREIGN KEY (voucher_id) REFERENCES dbo.vouchers (id);
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_voucher_usages_tx')
    ALTER TABLE dbo.voucher_usages ADD CONSTRAINT FK_voucher_usages_tx FOREIGN KEY (transaction_id) REFERENCES dbo.transactions (id);
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_slots_teacher')
    ALTER TABLE dbo.teacher_availability ADD CONSTRAINT FK_slots_teacher FOREIGN KEY (teacher_id) REFERENCES dbo.users (id);
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_bookings_user')
    ALTER TABLE dbo.bookings ADD CONSTRAINT FK_bookings_user FOREIGN KEY (user_id) REFERENCES dbo.users (id);
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_bookings_slot')
    ALTER TABLE dbo.bookings ADD CONSTRAINT FK_bookings_slot FOREIGN KEY (slot_id) REFERENCES dbo.teacher_availability (id);
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_bookings_package')
    ALTER TABLE dbo.bookings ADD CONSTRAINT FK_bookings_package FOREIGN KEY (user_package_id) REFERENCES dbo.user_packages (id);
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_class_logs_booking')
    ALTER TABLE dbo.class_logs ADD CONSTRAINT FK_class_logs_booking FOREIGN KEY (booking_id) REFERENCES dbo.bookings (id);
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_class_logs_user')
    ALTER TABLE dbo.class_logs ADD CONSTRAINT FK_class_logs_user FOREIGN KEY (user_id) REFERENCES dbo.users (id);
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_move_booking')
    ALTER TABLE dbo.move_requests ADD CONSTRAINT FK_move_booking FOREIGN KEY (booking_id) REFERENCES dbo.bookings (id);
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_move_user')
    ALTER TABLE dbo.move_requests ADD CONSTRAINT FK_move_user FOREIGN KEY (user_id) REFERENCES dbo.users (id);
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_move_slot')
    ALTER TABLE dbo.move_requests ADD CONSTRAINT FK_move_slot FOREIGN KEY (requested_slot_id) REFERENCES dbo.teacher_availability (id);
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_notifications_user')
    ALTER TABLE dbo.notifications ADD CONSTRAINT FK_notifications_user FOREIGN KEY (user_id) REFERENCES dbo.users (id);
GO
