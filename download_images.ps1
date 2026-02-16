$images = @(
    @{
        Url  = "https://aboutface.com/cdn/shop/products/Cherry-Pick_Component_Swatch_0002_THE-CRANBERRIES-CAP-ON_1.png?v=1677263169"
        Dest = "public/images/hero-product-2.png"
    },
    @{
        Url  = "https://aboutface.com/cdn/shop/products/MFEP-Minis__0014_Blue-Monday-Shot-2.png?v=1677802576&width=1000"
        Dest = "public/images/hero-product-3.png"
    },
    @{
        Url  = "https://aboutface.com/cdn/shop/files/AF_CheekFreak_GetSome_Open_Web.png?v=1719253456&width=1000"
        Dest = "public/images/hero-product-4.png"
    },
    @{
        Url  = "https://aboutface.com/cdn/shop/products/LLHF-Shaken-or-Stirred-Shot-1.png?v=1630101035&width=1000"
        Dest = "public/images/hero-product-5.png"
    }
)

$webClient = New-Object System.Net.WebClient
$webClient.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")

foreach ($img in $images) {
    Write-Host "Downloading $($img.Dest)..."
    try {
        $webClient.DownloadFile($img.Url, $img.Dest)
        Write-Host "Success."
    }
    catch {
        Write-Host "Error downloading $($img.Url): $_"
    }
}
