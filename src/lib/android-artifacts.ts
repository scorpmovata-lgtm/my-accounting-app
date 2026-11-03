// اسناد و کد آماده‌ی دیپلوی برای فاز ۴ — اپ اندروید
// Kotlin + Jetpack Compose + Supabase Kotlin SDK

export interface AndroidStep {
  title: string;
  detail: string;
  command?: string;
}

export const ANDROID_STEPS: AndroidStep[] = [
  {
    title: "نصب Android Studio",
    detail:
      "از https://developer.android.com/studio دانلود و نصب کن. این شامل Android SDK، Emulator و Kotlin plugin است.",
  },
  {
    title: "ساخت پروژه جدید",
    detail:
      "Android Studio را باز کن → New Project → Empty Activity (Compose) → نام: MyAccounting → Package: ir.myaccounting.app → Minimum SDK: 24 (Android 7.0).",
  },
  {
    title: "تنظیم Repository (Supabase Kotlin SDK)",
    detail:
      "فایل settings.gradle.kts را باز کن و این repository را به‌جای repositories اضافه کن:",
    command:
      "dependencyResolutionManagement {\n    repositories {\n        google()\n        mavenCentral()\n        maven(\"https://oss.sonatype.org/content/repositories/snapshots\")\n    }\n}",
  },
  {
    title: "افزودن وابستگی‌ها",
    detail:
      "فایل app/build.gradle.kts را باز کن و محتوای کارت «۵. Android: build.gradle.kts» را جایگزین کن.",
  },
  {
    title: "تنظیم AndroidManifest",
    detail:
      "فایل app/src/main/AndroidManifest.xml را باز کن و محتوای کارت «۶. Android: Manifest» را جایگزین کن.",
  },
  {
    title: "ایجاد فایل‌های Kotlin",
    detail:
      "در پوشه app/src/main/java/ir/myaccounting/app/ این فایل‌ها را بساز:\n- data/SupabaseClient.kt\n- data/Models.kt\n- data/AuthRepository.kt\n- data/AccountingRepository.kt\n- ui/Theme.kt\n- ui/LoginScreen.kt\n- ui/DashboardScreen.kt\n- ui/TransactionFormScreen.kt\n- MainActivity.kt (در پوشه اصلی package)\nمحتوای هر فایل از کارت‌های ۷ تا ۹ کپی کن.",
  },
  {
    title: "تنظیم مقادیر Supabase",
    detail:
      "در فایل SupabaseClient.kt، مقادیر SUPABASE_URL و SUPABASE_ANON_KEY را با مقادیر واقعی از پروژه Supabase خودت جایگزین کن.",
  },
  {
    title: "اجرا روی Emulator یا گوشی",
    detail:
      "در Android Studio دکمه Run را بزن. اپ روی emulator باز می‌شود. با ایمیل و رمزی که در Supabase Authentication ساختی وارد شو.",
  },
];

export const ANDROID_BUILD_GRADLE_KTS = `// ============================================================
// مسیر فایل: app/build.gradle.kts
// جایگزین کل محتوای فایل موجود در پروژه جدید کن
// ============================================================

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "ir.myaccounting.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "ir.myaccounting.app"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "0.1"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    // Compose BOM
    val composeBom = platform("androidx.compose:compose-bom:2024.10.00")
    implementation(composeBom)

    // Compose UI + Material3
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.navigation:navigation-compose:2.8.3")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.6")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.6")
    implementation("androidx.compose.material:material-icons-extended")

    // Supabase Kotlin SDK
    implementation("io.github.jan-supabase:supabase-kt:3.0.3")
    implementation("io.github.jan-supabase:gotrue-kt:3.0.3")
    implementation("io.github.jan-supabase:postgrest-kt:3.0.3")
    implementation("io.github.jan-supabase:functions-kt:3.0.3")

    // Ktor (موتور HTTP برای Supabase)
    implementation("io.ktor:ktor-client-android:3.0.1")

    // Debug
    debugImplementation("androidx.compose.ui:ui-tooling")
}
`;

export const ANDROID_MANIFEST_XML = `<?xml version="1.0" encoding="utf-8"?>
<!-- ============================================================ -->
<!-- مسیر فایل: app/src/main/AndroidManifest.xml -->
<!-- ============================================================ -->

<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- برای دسترسی به Supabase API -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="دفتر حسابداری"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.MyAccounting"
        android:usesCleartextTraffic="false">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:theme="@style/Theme.MyAccounting">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
`;

export const ANDROID_KOTLIN_DATA = `// ============================================================
// فایل‌های لایه داده (data layer)
// همه این فایل‌ها را در پوشه app/src/main/java/ir/myaccounting/app/data/ بگذار
// ============================================================

// ===== FILE: data/SupabaseClient.kt =====
package ir.myaccounting.app.data

import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.functions.Functions
import io.github.jan.supabase.gotrue.Auth
import io.github.jan.supabase.postgrest.Postgrest

// ⚠️ این مقادیر را با مقادیر واقعی پروژه Supabase خودت جایگزین کن
// از Settings → API در داشبورد Supabase بگیر
const val SUPABASE_URL = "https://YOUR-PROJECT.supabase.co"
const val SUPABASE_ANON_KEY = "YOUR-ANON-PUBLIC-KEY"

object SupabaseProvider {
    val client: SupabaseClient = createSupabaseClient(
        supabaseUrl = SUPABASE_URL,
        supabaseKey = SUPABASE_ANON_KEY
    ) {
        install(Auth)
        install(Postgrest)
        install(Functions)
    }
}

// ===== FILE: data/Models.kt =====
package ir.myaccounting.app.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class Ledger(
    val id: String,
    @SerialName("owner_user_id") val ownerUserId: String,
    val name: String,
    @SerialName("default_currency") val defaultCurrency: String
)

@Serializable
data class Contact(
    val id: String,
    @SerialName("ledger_id") val ledgerId: String,
    @SerialName("display_name") val displayName: String,
    val notes: String? = null,
    @SerialName("linked_telegram_id") val linkedTelegramId: Long? = null,
    @SerialName("created_at") val createdAt: String
)

@Serializable
data class Category(
    val id: String,
    @SerialName("ledger_id") val ledgerId: String,
    val name: String,
    @SerialName("is_active") val isActive: Boolean,
    @SerialName("sort_order") val sortOrder: Int,
    @SerialName("created_at") val createdAt: String
)

@Serializable
data class Transaction(
    val id: String,
    @SerialName("ledger_id") val ledgerId: String,
    @SerialName("contact_id") val contactId: String,
    @SerialName("category_id") val categoryId: String? = null,
    @SerialName("transaction_type") val transactionType: String,
    val amount: Long,
    val currency: String,
    @SerialName("effective_at") val effectiveAt: String,
    @SerialName("created_at") val createdAt: String,
    @SerialName("created_by") val createdBy: String,
    val description: String? = null,
    val status: String,
    @SerialName("idempotency_key") val idempotencyKey: String
)

// ===== FILE: data/AuthRepository.kt =====
package ir.myaccounting.app.data

import io.github.jan.supabase.gotrue.auth

object AuthRepository {
    suspend fun signIn(email: String, password: String): Boolean {
        return try {
            SupabaseProvider.client.auth.signInWith(Email) {
                this.email = email
                this.password = password
            }
            true
        } catch (e: Exception) {
            println("Login error: " + e.message)
            false
        }
    }

    suspend fun signOut() {
        try {
            SupabaseProvider.client.auth.signOut()
        } catch (e: Exception) {
            println("Logout error: " + e.message)
        }
    }

    fun getCurrentUserId(): String? {
        return try {
            SupabaseProvider.client.auth.currentSessionOrNull()?.user?.id
        } catch (e: Exception) {
            null
        }
    }

    fun isLoggedIn(): Boolean = getCurrentUserId() != null
}

// ===== FILE: data/AccountingRepository.kt =====
package ir.myaccounting.app.data

import io.github.jan.supabase.functions.functions
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.PostgrestQueryBuilder
import kotlinx.serialization.Serializable

object AccountingRepository {

    private const val LEDGERS_TABLE = "ledgers"
    private const val CONTACTS_TABLE = "contacts"
    private const val CATEGORIES_TABLE = "categories"
    private const val TRANSACTIONS_TABLE = "transactions"
    private const val AUDIT_LOGS_TABLE = "audit_logs"
    private const val TELEGRAM_LINKS_TABLE = "telegram_links"
    private const val LINK_CODES_TABLE = "link_codes"

    suspend fun fetchLedgerId(userId: String): String? {
        return try {
            val result = SupabaseProvider.client.from(LEDGERS_TABLE).select {
                filter { eq("owner_user_id", userId); isNull("archived_at", true) }
                limit(1)
            }.decodeAs<List<Ledger>>()
            result.firstOrNull()?.id
        } catch (e: Exception) {
            println("fetchLedgerId error: " + e.message)
            null
        }
    }

    suspend fun fetchContacts(ledgerId: String): List<Contact> {
        return try {
            SupabaseProvider.client.from(CONTACTS_TABLE).select {
                filter { eq("ledger_id", ledgerId); isNull("archived_at", true) }
                order("created_at", ascending = true)
            }.decodeAs()
        } catch (e: Exception) {
            println("fetchContacts error: " + e.message)
            emptyList()
        }
    }

    suspend fun fetchCategories(ledgerId: String): List<Category> {
        return try {
            SupabaseProvider.client.from(CATEGORIES_TABLE).select {
                filter { eq("ledger_id", ledgerId) }
                order("sort_order", ascending = true)
            }.decodeAs()
        } catch (e: Exception) {
            println("fetchCategories error: " + e.message)
            emptyList()
        }
    }

    suspend fun fetchTransactions(ledgerId: String): List<Transaction> {
        return try {
            SupabaseProvider.client.from(TRANSACTIONS_TABLE).select {
                filter { eq("ledger_id", ledgerId) }
                order("effective_at", ascending = false)
                limit(100)
            }.decodeAs()
        } catch (e: Exception) {
            println("fetchTransactions error: " + e.message)
            emptyList()
        }
    }

    // ثبت تراکنش از طریق Edge Function
    @Serializable
    data class TransactionInput(
        @SerialName("contactId") val contactId: String,
        @SerialName("categoryId") val categoryId: String? = null,
        @SerialName("transactionType") val transactionType: String,
        val amount: Long,
        val currency: String,
        @SerialName("effectiveAt") val effectiveAt: String,
        val description: String? = null,
        @SerialName("idempotencyKey") val idempotencyKey: String
    )

    @Serializable
    data class TransactionResponse(
        val ok: Boolean,
        val transaction: Transaction? = null,
        val error: String? = null
    )

    suspend fun addTransaction(input: TransactionInput): Boolean {
        return try {
            val response = SupabaseProvider.client.functions.invoke(
                functionName = "create-transaction",
                body = input
            )
            val result = response.decodeAs<TransactionResponse>()
            result.ok
        } catch (e: Exception) {
            println("addTransaction error: " + e.message)
            false
        }
    }
}
`;

export const ANDROID_KOTLIN_UI = `// ============================================================
// فایل‌های UI (Compose) + MainActivity
// فایل MainActivity.kt در پوشه اصلی package بگذار
// بقیه در پوشه ui/
// ============================================================

// ===== FILE: MainActivity.kt =====
package ir.myaccounting.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import ir.myaccounting.app.data.AuthRepository
import ir.myaccounting.app.ui.MyAccountingTheme
import ir.myaccounting.app.ui.NavGraph

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            MyAccountingTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    val isLoggedIn = AuthRepository.isLoggedIn()
                    NavGraph(startLoggedIn = isLoggedIn)
                }
            }
        }
    }
}

// ===== FILE: ui/Theme.kt =====
package ir.myaccounting.app.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// پالت رنگ — مطابق نسخه وب (emerald + rose)
private val Primary = Color(0xFF0F766E)  // emerald-700
private val OnPrimary = Color(0xFFFFFFFF)
private val Secondary = Color(0xFFF1F5F9)
private val OnSecondary = Color(0xFF1E293B)
private val Background = Color(0xFFFAFAF9)
private val Surface = Color(0xFFFFFFFF)
private val Error = Color(0xFFB91C1C)

private val LightColors = lightColorScheme(
    primary = Primary,
    onPrimary = OnPrimary,
    secondary = Secondary,
    onSecondary = OnSecondary,
    background = Background,
    surface = Surface,
    error = Error
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFF2DD4BF),
    onPrimary = Color(0xFF003029),
    secondary = Color(0xFF1E293B),
    onSecondary = Color(0xFFE2E8F0),
    background = Color(0xFF0C0A09),
    surface = Color(0xFF1C1917),
    error = Color(0xFFFCA5A5)
)

@Composable
fun MyAccountingTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colors = if (darkTheme) DarkColors else LightColors
    MaterialTheme(
        colorScheme = colors,
        content = content
    )
}

// ===== FILE: ui/NavGraph.kt =====
package ir.myaccounting.app.ui

import androidx.compose.runtime.Composable
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController

@Composable
fun NavGraph(startLoggedIn: Boolean) {
    val navController = rememberNavController()
    val startRoute = if (startLoggedIn) "dashboard" else "login"

    NavHost(navController = navController, startDestination = startRoute) {
        composable("login") {
            LoginScreen(
                onLoginSuccess = {
                    navController.navigate("dashboard") {
                        popUpTo("login") { inclusive = true }
                    }
                }
            )
        }
        composable("dashboard") {
            DashboardScreen(
                onAddTransaction = { navController.navigate("add_transaction") },
                onLogout = {
                    navController.navigate("login") {
                        popUpTo("dashboard") { inclusive = true }
                    }
                }
            )
        }
        composable("add_transaction") {
            TransactionFormScreen(
                onDone = { navController.popBackStack() }
            )
        }
    }
}

// ===== FILE: ui/LoginScreen.kt =====
package ir.myaccounting.app.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import ir.myaccounting.app.data.AuthRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
fun LoginScreen(onLoginSuccess: () -> Unit) {
    val scope = rememberCoroutineScope()
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = "دفتر حسابداری",
            style = MaterialTheme.typography.headlineMedium
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "برای ورود، ایمیل و رمز خود را وارد کنید",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
        )
        Spacer(modifier = Modifier.height(24.dp))

        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            label = { Text("ایمیل") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email)
        )
        Spacer(modifier = Modifier.height(12.dp))

        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("رمز") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password)
        )
        Spacer(modifier = Modifier.height(16.dp))

        error?.let {
            Text(
                text = it,
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodySmall
            )
            Spacer(modifier = Modifier.height(8.dp))
        }

        Button(
            onClick = {
                if (email.isBlank() || password.isBlank()) {
                    error = "ایمیل و رمز را وارد کنید"
                    return@Button
                }
                scope.launch {
                    loading = true
                    error = null
                    val success = withContext(Dispatchers.IO) {
                        AuthRepository.signIn(email.trim(), password)
                    }
                    loading = false
                    if (success) {
                        onLoginSuccess()
                    } else {
                        error = "ورود ناموفق. ایمیل یا رمز اشتباه است."
                    }
                }
            },
            enabled = !loading,
            modifier = Modifier.fillMaxWidth()
        ) {
            if (loading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(20.dp),
                    strokeWidth = 2.dp,
                    color = MaterialTheme.colorScheme.onPrimary
                )
            } else {
                Text("ورود")
            }
        }
    }
}

// ===== FILE: ui/DashboardScreen.kt =====
package ir.myaccounting.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import ir.myaccounting.app.data.AccountingRepository
import ir.myaccounting.app.data.AuthRepository
import ir.myaccounting.app.data.Contact
import ir.myaccounting.app.data.Transaction
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
fun DashboardScreen(
    onAddTransaction: () -> Unit,
    onLogout: () -> Unit
) {
    val scope = rememberCoroutineScope()
    var contacts by remember { mutableStateOf<List<Contact>>(emptyList()) }
    var transactions by remember { mutableStateOf<List<Transaction>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }

    LaunchedEffect(Unit) {
        val userId = AuthRepository.getCurrentUserId()
        if (userId != null) {
            withContext(Dispatchers.IO) {
                val ledgerId = AccountingRepository.fetchLedgerId(userId)
                if (ledgerId != null) {
                    contacts = AccountingRepository.fetchContacts(ledgerId)
                    transactions = AccountingRepository.fetchTransactions(ledgerId)
                }
            }
        }
        loading = false
    }

    Scaffold(
        topBar = {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "داشبورد",
                    style = MaterialTheme.typography.headlineSmall
                )
                Row {
                    TextButton(onClick = onLogout) {
                        Text("خروج")
                    }
                }
            }
        },
        floatingActionButton = {
            FloatingActionButton(onClick = onAddTransaction) {
                Text("+", style = MaterialTheme.typography.headlineLarge)
            }
        }
    ) { padding ->
        if (loading) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator()
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // کارت مانده
                item { BalanceCard(transactions) }

                item {
                    Text(
                        text = "طرف حساب‌ها",
                        style = MaterialTheme.typography.titleMedium,
                        modifier = Modifier.padding(top = 8.dp)
                    )
                }
                items(contacts) { contact ->
                    ContactRow(contact, transactions)
                }

                item {
                    Text(
                        text = "آخرین تراکنش‌ها",
                        style = MaterialTheme.typography.titleMedium,
                        modifier = Modifier.padding(top = 16.dp)
                    )
                }
                items(transactions.take(10)) { txn ->
                    TransactionRow(txn, contacts)
                }
            }
        }
    }
}

@Composable
private fun BalanceCard(transactions: List<Transaction>) {
    var receivable = 0L
    var payable = 0L
    for (t in transactions) {
        if (t.status != "POSTED") continue
        when (t.transactionType) {
            "RECEIVABLE_CHARGE", "OPENING_RECEIVABLE" -> receivable += t.amount
            "PAYABLE_CHARGE", "OPENING_PAYABLE" -> payable += t.amount
            "RECEIPT_ALLOCATION" -> receivable -= t.amount
            "PAYMENT_ALLOCATION" -> payable -= t.amount
        }
    }

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        BalanceBox(
            label = "طلب کل",
            amount = receivable,
            color = Color(0xFF10B981),
            modifier = Modifier.weight(1f)
        )
        BalanceBox(
            label = "بدهی کل",
            amount = payable,
            color = Color(0xFFF43F5E),
            modifier = Modifier.weight(1f)
        )
    }
}

@Composable
private fun BalanceBox(
    label: String,
    amount: Long,
    color: Color,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(color.copy(alpha = 0.1f))
            .padding(16.dp)
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelMedium,
            color = color
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = formatAmount(amount),
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            color = color
        )
    }
}

@Composable
private fun ContactRow(contact: Contact, transactions: List<Transaction>) {
    var receivable = 0L
    var payable = 0L
    for (t in transactions) {
        if (t.contactId != contact.id || t.status != "POSTED") continue
        when (t.transactionType) {
            "RECEIVABLE_CHARGE", "OPENING_RECEIVABLE" -> receivable += t.amount
            "PAYABLE_CHARGE", "OPENING_PAYABLE" -> payable += t.amount
            "RECEIPT_ALLOCATION" -> receivable -= t.amount
            "PAYMENT_ALLOCATION" -> payable -= t.amount
        }
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = contact.displayName,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold
            )
            Spacer(modifier = Modifier.height(4.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    text = "طلب: " + formatAmount(receivable),
                    style = MaterialTheme.typography.bodySmall,
                    color = Color(0xFF10B981)
                )
                Text(
                    text = "بدهی: " + formatAmount(payable),
                    style = MaterialTheme.typography.bodySmall,
                    color = Color(0xFFF43F5E)
                )
            }
        }
    }
}

@Composable
private fun TransactionRow(txn: Transaction, contacts: List<Contact>) {
    val contact = contacts.find { it.id == txn.contactId }
    val isReceivable = txn.transactionType in listOf(
        "RECEIVABLE_CHARGE", "OPENING_RECEIVABLE", "RECEIPT_ALLOCATION"
    )
    val sign = if (txn.transactionType in listOf(
            "RECEIVABLE_CHARGE", "OPENING_RECEIVABLE",
            "PAYABLE_CHARGE", "OPENING_PAYABLE"
        )
    ) "+" else "−"

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = contact?.displayName ?: "—",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium
                )
                Text(
                    text = txn.description ?: txn.transactionType,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                )
                Text(
                    text = txn.effectiveAt,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                )
            }
            Text(
                text = sign + " " + formatAmount(txn.amount),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = if (isReceivable) Color(0xFF10B981) else Color(0xFFF43F5E)
            )
        }
    }
}

private fun formatAmount(amount: Long): String {
    val persianDigits = amount.toString().reversed().chunked(3).joinToString(",").reversed()
    return persianDigits.map { c ->
        if (c.isDigit()) ('۰' + c.digitToInt()) else c
    } + " تومان"
}

// ===== FILE: ui/TransactionFormScreen.kt =====
package ir.myaccounting.app.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import ir.myaccounting.app.data.AccountingRepository
import ir.myaccounting.app.data.AuthRepository
import ir.myaccounting.app.data.Contact
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.LocalDate
import java.time.format.DateTimeFormatter

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TransactionFormScreen(onDone: () -> Unit) {
    val scope = rememberCoroutineScope()
    var contacts by remember { mutableStateOf<List<Contact>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var submitting by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    var selectedContact by remember { mutableStateOf<Contact?>(null) }
    var type by remember { mutableStateOf("RECEIVABLE_CHARGE") }
    var amount by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var date by remember { mutableStateOf(LocalDate.now().toString()) }
    var menuExpanded by remember { mutableStateOf(false) }

    val types = listOf(
        "RECEIVABLE_CHARGE" to "ایجاد طلب",
        "PAYABLE_CHARGE" to "ایجاد بدهی",
        "RECEIPT_ALLOCATION" to "دریافت",
        "PAYMENT_ALLOCATION" to "پرداخت",
        "OPENING_RECEIVABLE" to "مانده اولیه طلب",
        "OPENING_PAYABLE" to "مانده اولیه بدهی"
    )

    LaunchedEffect(Unit) {
        val userId = AuthRepository.getCurrentUserId()
        if (userId != null) {
            withContext(Dispatchers.IO) {
                val ledgerId = AccountingRepository.fetchLedgerId(userId)
                if (ledgerId != null) {
                    contacts = AccountingRepository.fetchContacts(ledgerId)
                }
            }
        }
        loading = false
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("ثبت تراکنش") }
            )
        }
    ) { padding ->
        if (loading) {
            Box(modifier = Modifier.padding(padding), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        } else {
            Column(
                modifier = Modifier
                    .padding(padding)
                    .padding(16.dp)
                    .fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // نوع عملیات
                ExposedDropdownMenuBox(
                    expanded = menuExpanded,
                    onExpandedChange = { menuExpanded = it }
                ) {
                    OutlinedTextField(
                        value = types.find { it.first == type }?.second ?: "",
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("نوع عملیات") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(menuExpanded) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor()
                    )
                    ExposedDropdownMenu(
                        expanded = menuExpanded,
                        onDismissRequest = { menuExpanded = false }
                    ) {
                        types.forEach { (val_, label) ->
                            DropdownMenuItem(
                                text = { Text(label) },
                                onClick = {
                                    type = val_
                                    menuExpanded = false
                                }
                            )
                        }
                    }
                }

                // طرف حساب
                var contactMenuExpanded by remember { mutableStateOf(false) }
                ExposedDropdownMenuBox(
                    expanded = contactMenuExpanded,
                    onExpandedChange = { contactMenuExpanded = it }
                ) {
                    OutlinedTextField(
                        value = selectedContact?.displayName ?: "",
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("طرف حساب") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(contactMenuExpanded) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor()
                    )
                    ExposedDropdownMenu(
                        expanded = contactMenuExpanded,
                        onDismissRequest = { contactMenuExpanded = false }
                    ) {
                        contacts.forEach { c ->
                            DropdownMenuItem(
                                text = { Text(c.displayName) },
                                onClick = {
                                    selectedContact = c
                                    contactMenuExpanded = false
                                }
                            )
                        }
                    }
                }

                // مبلغ
                OutlinedTextField(
                    value = amount,
                    onValueChange = { amount = it.filter { c -> c.isDigit() } },
                    label = { Text("مبلغ (تومان)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                )

                // تاریخ
                OutlinedTextField(
                    value = date,
                    onValueChange = { date = it },
                    label = { Text("تاریخ (YYYY-MM-DD)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                // توضیحات
                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("توضیحات (اختیاری)") },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 2
                )

                error?.let {
                    Text(
                        text = it,
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodySmall
                    )
                }

                Spacer(modifier = Modifier.weight(1f))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    OutlinedButton(
                        onClick = onDone,
                        modifier = Modifier.weight(1f)
                    ) { Text("انصراف") }

                    Button(
                        onClick = {
                            val contact = selectedContact
                            val amt = amount.toLongOrNull()
                            if (contact == null) {
                                error = "یک طرف حساب انتخاب کنید"
                                return@Button
                            }
                            if (amt == null || amt <= 0) {
                                error = "مبلغ معتبر وارد کنید"
                                return@Button
                            }
                            scope.launch {
                                submitting = true
                                error = null
                                val input = AccountingRepository.TransactionInput(
                                    contactId = contact.id,
                                    transactionType = type,
                                    amount = amt,
                                    currency = "IRT",
                                    effectiveAt = date,
                                    description = description.ifBlank { null },
                                    idempotencyKey = "android-" + System.currentTimeMillis() + "-" + (0..9999).random()
                                )
                                val success = withContext(Dispatchers.IO) {
                                    AccountingRepository.addTransaction(input)
                                }
                                submitting = false
                                if (success) {
                                    onDone()
                                } else {
                                    error = "ثبت ناموفق. دوباره تلاش کنید."
                                }
                            }
                        },
                        enabled = !submitting,
                        modifier = Modifier.weight(1f)
                    ) {
                        if (submitting) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                strokeWidth = 2.dp
                            )
                        } else {
                            Text("ثبت")
                        }
                    }
                }
            }
        }
    }
}
`;
